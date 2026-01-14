#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "browser_cookie3"]
# ///
"""
Download play.gu.se (Kaltura) videos using direct API access.
"""

import re
import json
import requests
from pathlib import Path
import browser_cookie3
import subprocess

OUTPUT_DIR = Path(__file__).parent / "canvas-lms"
VIDEOS_DIR = OUTPUT_DIR / "_videos"

def get_gu_session():
    """Get session with GU cookies"""
    session = requests.Session()
    try:
        cj = browser_cookie3.brave(domain_name='.gu.se')
        for cookie in cj:
            session.cookies.set(cookie.name, cookie.value, domain=cookie.domain)
    except Exception as e:
        print(f"Warning: Could not get cookies: {e}")
    return session


def get_kaltura_ks_from_embed(session, entry_id):
    """Get Kaltura session token from embed page"""
    url = f"https://play.gu.se/embed/secure/iframe/entryId/{entry_id}/uiConfId/23450401"
    resp = session.get(url, allow_redirects=True)
    if not resp.ok:
        return None

    # Find ks token in flashvars
    ks_match = re.search(r'flashvars\[ks\]=([^&"\']+)', resp.text)
    if ks_match:
        return ks_match.group(1)

    # Alternative patterns
    for pattern in [r'"ks"\s*:\s*"([^"]+)"', r"'ks'\s*:\s*'([^']+)'", r'ks=([a-zA-Z0-9_\-=]+)']:
        ks_match = re.search(pattern, resp.text)
        if ks_match:
            return ks_match.group(1)

    return None


def get_video_info(session, entry_id, ks):
    """Get video metadata from Kaltura API"""
    url = "https://play.gu.se/api_v3/service/baseEntry/action/get"
    params = {
        "entryId": entry_id,
        "ks": ks,
        "format": "1"  # JSON
    }
    resp = session.get(url, params=params)
    if resp.ok:
        return resp.json()
    return None


def get_flavor_assets(session, entry_id, ks):
    """Get available video flavors (qualities)"""
    url = "https://play.gu.se/api_v3/service/flavorAsset/action/list"
    params = {
        "filter[entryIdEqual]": entry_id,
        "ks": ks,
        "format": "1"
    }
    resp = session.get(url, params=params)
    if resp.ok:
        data = resp.json()
        if 'objects' in data:
            return data['objects']
    return []


def download_video(session, entry_id, ks, dest_path):
    """Download video using playManifest"""
    # Get flavors
    flavors = get_flavor_assets(session, entry_id, ks)
    if not flavors:
        print(f"    No flavors found")
        return False

    # Get highest bitrate flavor
    best_flavor = max(flavors, key=lambda f: f.get('bitrate', 0))
    flavor_id = best_flavor.get('id')
    bitrate = best_flavor.get('bitrate', 0)

    print(f"    Best quality: {bitrate} kbps, flavor: {flavor_id}")

    # Try direct download URL
    download_url = f"https://play.gu.se/p/302/sp/30200/playManifest/entryId/{entry_id}/flavorId/{flavor_id}/format/download/protocol/https/ks/{ks}"

    resp = session.get(download_url, stream=True, allow_redirects=True)
    if resp.ok:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        total = int(resp.headers.get('content-length', 0))
        with open(dest_path, 'wb') as f:
            downloaded = 0
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    print(f"\r    Downloading: {pct}% ({downloaded//1024//1024}MB)", end='', flush=True)
        print()
        return True
    else:
        print(f"    Download failed: {resp.status_code}")

    return False


def sanitize_filename(name):
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:100]


def main():
    print("="*70)
    print("Play.gu.se Video Downloader")
    print("="*70)

    # Load video list
    videos_json = VIDEOS_DIR / "play_gu_videos.json"
    if not videos_json.exists():
        print("Run download_kaltura.py first to find videos")
        return

    videos = json.loads(videos_json.read_text())
    print(f"Found {len(videos)} videos to process")

    session = get_gu_session()
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    failed = 0

    for i, video in enumerate(videos, 1):
        entry_id = video['entry_id']
        print(f"\n[{i}/{len(videos)}] Entry: {entry_id}")

        # Get KS token
        ks = get_kaltura_ks_from_embed(session, entry_id)
        if not ks:
            print("    Could not get KS token")
            failed += 1
            continue

        # Get video info
        info = get_video_info(session, entry_id, ks)
        if info:
            title = info.get('name', entry_id)
            duration = info.get('duration', 0)
            print(f"    Title: {title}")
            print(f"    Duration: {duration}s")
        else:
            title = entry_id

        # Download
        filename = sanitize_filename(f"{title}.mp4")
        dest_path = VIDEOS_DIR / filename

        if dest_path.exists():
            print(f"    Already exists: {filename}")
            downloaded += 1
            continue

        if download_video(session, entry_id, ks, dest_path):
            downloaded += 1
            print(f"    Saved: {filename}")
        else:
            failed += 1

    print("\n" + "="*70)
    print(f"COMPLETE: {downloaded} downloaded, {failed} failed")
    print("="*70)


if __name__ == "__main__":
    main()
