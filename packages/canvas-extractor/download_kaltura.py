#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "browser_cookie3", "beautifulsoup4"]
# ///
"""
Download videos from play.gu.se (Kaltura) and list JoVE videos.
"""

import re
import json
import requests
from pathlib import Path
from bs4 import BeautifulSoup
import browser_cookie3

OUTPUT_DIR = Path(__file__).parent / "canvas-lms"
VIDEOS_DIR = OUTPUT_DIR / "_videos"

def get_gu_cookies() -> dict:
    """Get cookies from Brave for gu.se"""
    try:
        cj = browser_cookie3.brave(domain_name='.gu.se')
        return {c.name: c.value for c in cj}
    except Exception as e:
        print(f"Warning: Could not get cookies: {e}")
        return {}


def extract_kaltura_ks(embed_url: str, cookies: dict) -> tuple[str, str]:
    """Extract Kaltura session (ks) and entry info from embed page"""
    resp = requests.get(f"https://{embed_url}", cookies=cookies)
    if not resp.ok:
        return None, None

    # Find the ks token in the page
    ks_match = re.search(r'ks["\']?\s*[=:]\s*["\']?([a-zA-Z0-9_\-=]+)', resp.text)
    ks = ks_match.group(1) if ks_match else None

    # Find video title
    title_match = re.search(r'title["\']?\s*[=:]\s*["\']([^"\']+)', resp.text)
    title = title_match.group(1) if title_match else None

    return ks, title


def get_kaltura_download_url(entry_id: str, ks: str) -> str:
    """Get direct download URL for a Kaltura video"""
    # Kaltura API endpoint for GU
    api_url = "https://play.gu.se/api_v3/service/multirequest"

    payload = {
        "1": {
            "service": "baseEntry",
            "action": "get",
            "entryId": entry_id,
            "ks": ks
        },
        "2": {
            "service": "flavorAsset",
            "action": "list",
            "filter": {"entryIdEqual": entry_id},
            "ks": ks
        }
    }

    resp = requests.post(api_url, json=payload)
    if not resp.ok:
        return None

    data = resp.json()

    # Get the best flavor (highest bitrate)
    if len(data) >= 2 and isinstance(data[1], dict) and 'objects' in data[1]:
        flavors = data[1]['objects']
        if flavors:
            # Sort by bitrate, get highest
            best_flavor = max(flavors, key=lambda f: f.get('bitrate', 0))
            flavor_id = best_flavor.get('id')

            # Construct download URL
            download_url = f"https://play.gu.se/p/302/sp/30200/playManifest/entryId/{entry_id}/flavorId/{flavor_id}/format/download/protocol/https/ks/{ks}"
            return download_url

    return None


def find_all_embedded_videos():
    """Find all embedded videos in HTML files"""
    play_gu_videos = []
    jove_videos = []

    for html_file in OUTPUT_DIR.rglob("*.html"):
        content = html_file.read_text(errors='ignore')

        # Find play.gu.se videos
        for match in re.finditer(r'play\.gu\.se/embed/secure/iframe/entryId/([^/"\s]+)', content):
            entry_id = match.group(1)
            play_gu_videos.append({
                'entry_id': entry_id,
                'source_file': str(html_file.relative_to(OUTPUT_DIR)),
                'url': f"play.gu.se/embed/secure/iframe/entryId/{entry_id}/uiConfId/23450401"
            })

        # Also check for play.gu.se/media URLs
        for match in re.finditer(r'play\.gu\.se/media/([^/"\s]+)/([^/"\s]+)', content):
            title = match.group(1)
            entry_id = match.group(2)
            play_gu_videos.append({
                'entry_id': entry_id,
                'title': title,
                'source_file': str(html_file.relative_to(OUTPUT_DIR)),
                'url': f"play.gu.se/media/{title}/{entry_id}"
            })

        # Find JoVE videos
        for match in re.finditer(r'app\.jove\.com/embed/player\?id=(\d+)[^"\']*access=([a-f0-9]+)', content):
            video_id = match.group(1)
            access = match.group(2)
            jove_videos.append({
                'id': video_id,
                'access': access,
                'source_file': str(html_file.relative_to(OUTPUT_DIR)),
                'url': f"https://app.jove.com/embed/player?id={video_id}&access={access}&t=1&s=1&fpv=1"
            })

    # Deduplicate
    seen_play = set()
    unique_play = []
    for v in play_gu_videos:
        if v['entry_id'] not in seen_play:
            seen_play.add(v['entry_id'])
            unique_play.append(v)

    seen_jove = set()
    unique_jove = []
    for v in jove_videos:
        if v['id'] not in seen_jove:
            seen_jove.add(v['id'])
            unique_jove.append(v)

    return unique_play, unique_jove


def main():
    print("="*70)
    print("Embedded Video Finder for LPG001")
    print("="*70)

    play_videos, jove_videos = find_all_embedded_videos()

    print(f"\nFound {len(play_videos)} play.gu.se videos (Kaltura)")
    print(f"Found {len(jove_videos)} JoVE videos")

    # Try to get video info for play.gu.se videos
    print("\n" + "="*70)
    print("PLAY.GU.SE VIDEOS (Kaltura)")
    print("="*70)

    cookies = get_gu_cookies()
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    for i, video in enumerate(play_videos, 1):
        entry_id = video['entry_id']
        print(f"\n[{i}/{len(play_videos)}] Entry: {entry_id}")
        print(f"    Source: {video['source_file']}")

        # Try to get download URL
        ks, title = extract_kaltura_ks(video['url'], cookies)
        if ks:
            video['ks'] = ks
            if title:
                video['title'] = title
                print(f"    Title: {title}")

            download_url = get_kaltura_download_url(entry_id, ks)
            if download_url:
                video['download_url'] = download_url
                print(f"    Download URL: Found!")

    # Save video list
    videos_json = VIDEOS_DIR / "play_gu_videos.json"
    videos_json.write_text(json.dumps(play_videos, indent=2, ensure_ascii=False))
    print(f"\nSaved play.gu.se video list to: {videos_json}")

    print("\n" + "="*70)
    print("JOVE VIDEOS (External)")
    print("="*70)

    for i, video in enumerate(jove_videos[:10], 1):  # Show first 10
        print(f"[{i}] ID: {video['id']}")
        print(f"    Source: {video['source_file']}")
        print(f"    URL: {video['url']}")

    if len(jove_videos) > 10:
        print(f"\n... and {len(jove_videos) - 10} more JoVE videos")

    jove_json = VIDEOS_DIR / "jove_videos.json"
    jove_json.write_text(json.dumps(jove_videos, indent=2, ensure_ascii=False))
    print(f"\nSaved JoVE video list to: {jove_json}")

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"play.gu.se videos: {len(play_videos)}")
    print(f"JoVE videos: {len(jove_videos)}")
    print(f"Total embedded videos: {len(play_videos) + len(jove_videos)}")


if __name__ == "__main__":
    main()
