#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "browser_cookie3"]
# ///
"""
Download play.gu.se videos via HLS manifest
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
        return None, None

    # Find ks token in flashvars
    ks_match = re.search(r'flashvars\[ks\]=([^&"\']+)', resp.text)
    ks = ks_match.group(1) if ks_match else None

    # Get title from page
    title_match = re.search(r'title="([^"]+)"', resp.text)
    title = title_match.group(1) if title_match else entry_id

    return ks, title


def get_direct_video_url(entry_id, ks):
    """Construct direct video download URL - using Kaltura NORDUnet CDN"""
    return f"https://api.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/url/protocol/https/ks/{ks}"


def download_video(session, video_url, output_path):
    """Download video directly"""
    try:
        resp = session.get(video_url, stream=True, timeout=300)
        if not resp.ok:
            return False

        total = int(resp.headers.get('content-length', 0))
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'wb') as f:
            downloaded = 0
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    mb = downloaded // 1024 // 1024
                    print(f"\r    Downloading: {pct}% ({mb}MB)", end='', flush=True)
        print()
        return True
    except Exception as e:
        print(f"\n    Download error: {e}")
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
        ks, title = get_kaltura_ks_from_embed(session, entry_id)
        if not ks:
            print("    Could not get KS token")
            failed += 1
            continue

        print(f"    Title: {title}")

        # Output path
        filename = sanitize_filename(f"{title}.mp4")
        dest_path = VIDEOS_DIR / filename

        if dest_path.exists():
            print(f"    Already exists: {filename}")
            downloaded += 1
            continue

        # Get direct video URL
        video_url = get_direct_video_url(entry_id, ks)

        if download_video(session, video_url, dest_path):
            downloaded += 1
            size_mb = dest_path.stat().st_size / 1024 / 1024
            print(f"    Saved: {filename} ({size_mb:.1f} MB)")
        else:
            failed += 1
            print(f"    Download failed")

    print("\n" + "="*70)
    print(f"COMPLETE: {downloaded} downloaded, {failed} failed")
    print("="*70)


if __name__ == "__main__":
    main()
