#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "browser_cookie3"]
# ///
"""
Download Canvas media attachments (videos embedded via media_attachments_iframe).
These are different from Kaltura videos and require Canvas authentication.
"""

import re
import json
import requests
from pathlib import Path
from bs4 import BeautifulSoup
import browser_cookie3

CANVAS_BASE_URL = "https://canvas.gu.se"
CANVAS_TOKEN = "12237~HFeZeAfLEaN6XUD2a6rE6hk4KNFhFhN2Fyt7z7FkcXTm2BZ9CVJrkPMY3VFHGCCk"
OUTPUT_DIR = Path(__file__).parent / "canvas-lms"
VIDEOS_DIR = OUTPUT_DIR / "_videos"


def get_session_with_cookies():
    """Get session with browser cookies for canvas.gu.se"""
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {CANVAS_TOKEN}"

    # Also try browser cookies as backup
    try:
        cj = browser_cookie3.brave(domain_name='.gu.se')
        for cookie in cj:
            session.cookies.set(cookie.name, cookie.value, domain=cookie.domain)
    except Exception as e:
        print(f"Note: Could not get browser cookies: {e}")

    return session


def find_all_media_attachments(base_dir: Path) -> list[dict]:
    """Find all media attachment references in HTML files"""
    attachments = []
    seen_ids = set()

    for html_file in base_dir.rglob("*.html"):
        content = html_file.read_text(encoding="utf-8", errors="ignore")

        # Find iframe embeds: media_attachments_iframe/ID?verifier=XXX
        for match in re.finditer(
            r'media_attachments_iframe/(\d+)\?verifier=([a-zA-Z0-9]+)',
            content
        ):
            media_id = match.group(1)
            verifier = match.group(2)

            if media_id in seen_ids:
                continue
            seen_ids.add(media_id)

            # Try to extract title from surrounding context
            title = None
            # Look for title="..." nearby
            title_match = re.search(
                rf'title="([^"]*\.mp4)"[^>]*media_attachments_iframe/{media_id}|'
                rf'media_attachments_iframe/{media_id}[^>]*title="([^"]*\.mp4)"',
                content
            )
            if title_match:
                title = title_match.group(1) or title_match.group(2)

            # Also try "Videospelare för X" pattern
            if not title:
                title_match = re.search(
                    rf'title="(?:Video(?:spelare)? (?:player )?för |Video player for )([^"]+)"[^>]*{media_id}',
                    content
                )
                if title_match:
                    title = title_match.group(1)
                    if not title.endswith('.mp4'):
                        title = title + '.mp4'

            attachments.append({
                "media_id": media_id,
                "verifier": verifier,
                "title": title,
                "source_file": str(html_file.relative_to(base_dir))
            })

    # Also check instructure_file_link references to media
    for html_file in base_dir.rglob("*.html"):
        content = html_file.read_text(encoding="utf-8", errors="ignore")

        for match in re.finditer(
            r'instructure_file_link[^>]*title="([^"]*\.mp4)"[^>]*'
            r'href="[^"]*media_attachments_iframe/(\d+)\?verifier=([a-zA-Z0-9]+)"',
            content
        ):
            title = match.group(1)
            media_id = match.group(2)
            verifier = match.group(3)

            if media_id in seen_ids:
                continue
            seen_ids.add(media_id)

            attachments.append({
                "media_id": media_id,
                "verifier": verifier,
                "title": title,
                "source_file": str(html_file.relative_to(base_dir))
            })

    return attachments


def get_media_download_url(session: requests.Session, media_id: str, verifier: str) -> tuple[str | None, str | None, str | None]:
    """Get the actual download URL for a media attachment.
    Returns: (url, error_info, title)
    """

    # Fetch the iframe page to get ENV data with media_sources
    iframe_url = f"{CANVAS_BASE_URL}/media_attachments_iframe/{media_id}?verifier={verifier}"

    resp = session.get(iframe_url)

    if not resp.ok:
        return None, f"HTTP {resp.status_code}", None

    # Extract ENV JSON from the HTML
    # Look for the media_sources in the ENV object
    env_match = re.search(r'ENV\s*=\s*(\{.*?\});', resp.text, re.DOTALL)
    if not env_match:
        return None, "Could not find ENV object", None

    try:
        # Parse the ENV JSON
        env_str = env_match.group(1)
        # Handle unicode escapes
        env_str = env_str.replace('\\u0026', '&')
        env_data = json.loads(env_str)

        # Get title from media_object
        title = None
        media_object = env_data.get('media_object', {})
        if media_object:
            title = media_object.get('title')

        # Get media_sources
        media_sources = media_object.get('media_sources', [])

        if not media_sources:
            return None, "No media_sources found", title

        # Get the highest bitrate source
        best_source = max(media_sources, key=lambda s: int(s.get('bitrate', 0)))
        url = best_source.get('url') or best_source.get('src')

        if url:
            # Ensure URL is properly decoded
            url = url.replace('\\u0026', '&')
            return url, None, title

        return None, "No URL in media_sources", title

    except json.JSONDecodeError as e:
        return None, f"JSON parse error: {e}", None
    except Exception as e:
        return None, f"Error: {e}", None


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:200]


def download_video(session: requests.Session, url: str, dest_path: Path) -> bool:
    """Download video from URL (handles both direct MP4 and DASH streams)"""
    import subprocess

    try:
        # First, check what we're getting
        resp = session.get(url, stream=True, timeout=300)
        if not resp.ok:
            print(f"    Download failed: HTTP {resp.status_code}")
            return False

        content_type = resp.headers.get('content-type', '')

        # Check if it's a DASH manifest (MPD)
        first_chunk = next(resp.iter_content(chunk_size=1024), b'')
        is_dash = b'<?xml' in first_chunk and b'MPD' in first_chunk

        if is_dash:
            print("    Detected DASH stream (Instructure Media)...")
            # These newer videos use Instructure Media with DASH/DRM
            # We need to follow the redirect to get the signed manifest URL

            # Get the redirect location (signed DASH manifest URL)
            resp_redir = session.get(url, allow_redirects=False)
            if resp_redir.status_code in [301, 302]:
                manifest_url = resp_redir.headers.get('Location')
                print(f"    Manifest: {manifest_url[:80]}...")

                dest_path.parent.mkdir(parents=True, exist_ok=True)

                # Try ffmpeg with the signed URL directly
                import subprocess
                cmd = [
                    "ffmpeg", "-y",
                    "-i", manifest_url,
                    "-c", "copy",
                    "-bsf:a", "aac_adtstoasc",
                    str(dest_path)
                ]

                print("    Downloading with ffmpeg...")
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
                if result.returncode == 0 and dest_path.exists() and dest_path.stat().st_size > 1000000:
                    return True
                else:
                    # ffmpeg sometimes doesn't handle CMAF well, try N_m3u8DL-RE or yt-dlp
                    print(f"    ffmpeg may have failed, checking output...")
                    if dest_path.exists():
                        size = dest_path.stat().st_size
                        if size > 1000000:  # > 1MB probably succeeded
                            return True
                        else:
                            print(f"    Output too small ({size} bytes), trying yt-dlp...")
                            dest_path.unlink()

                    # Try yt-dlp
                    cmd2 = ["yt-dlp", "-o", str(dest_path), manifest_url]
                    result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=3600)
                    if result2.returncode == 0 and dest_path.exists():
                        return True

                    print(f"    Could not download DASH stream")
                    print(f"    This video uses DRM-protected streaming.")
                    return False
            else:
                print(f"    Unexpected response: {resp_redir.status_code}")
                return False

        # Direct MP4 download
        total = int(resp.headers.get('content-length', 0))
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(dest_path, 'wb') as f:
            # Write the first chunk we already read
            f.write(first_chunk)
            downloaded = len(first_chunk)

            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    mb = downloaded // 1024 // 1024
                    print(f"\r    Downloading: {pct}% ({mb}MB)", end='', flush=True)
        print()
        return True
    except subprocess.TimeoutExpired:
        print("\n    ffmpeg timed out")
        return False
    except Exception as e:
        print(f"\n    Error: {e}")
        return False


def main():
    print("=" * 70)
    print("Canvas Media Attachments Downloader")
    print("=" * 70)

    # Find all media attachments in downloaded content
    print("\nScanning for media attachments...")
    attachments = find_all_media_attachments(OUTPUT_DIR)

    print(f"Found {len(attachments)} media attachments:\n")
    for att in attachments:
        title = att.get('title') or f"media_{att['media_id']}.mp4"
        print(f"  - {title}")
        print(f"    ID: {att['media_id']}, Source: {att['source_file']}")

    if not attachments:
        print("No media attachments found.")
        return

    # Download
    print("\n" + "=" * 70)
    print("Downloading...")
    print("=" * 70)

    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    session = get_session_with_cookies()

    downloaded = 0
    skipped = 0
    failed = 0

    for att in attachments:
        media_id = att['media_id']
        verifier = att['verifier']
        title = att.get('title') or f"media_{media_id}.mp4"
        filename = sanitize_filename(title)
        if not filename.endswith('.mp4'):
            filename += '.mp4'

        dest_path = VIDEOS_DIR / filename

        print(f"\n[{media_id}] {title}")

        if dest_path.exists():
            print(f"    Already exists: {filename}")
            skipped += 1
            continue

        # Get download URL
        url, debug_info, fetched_title = get_media_download_url(session, media_id, verifier)

        # Use fetched title if we didn't have one
        if fetched_title and (not title or title.startswith("media_")):
            title = fetched_title
            filename = sanitize_filename(title)
            if not filename.endswith('.mp4'):
                filename += '.mp4'
            dest_path = VIDEOS_DIR / filename

        if not url:
            print(f"    Could not get download URL")
            if debug_info:
                print(f"    Debug: {debug_info[:200]}...")
            failed += 1
            continue

        print(f"    Title: {title}")
        print(f"    URL: {url[:80]}...")

        if download_video(session, url, dest_path):
            downloaded += 1
            print(f"    Saved: {filename}")
        else:
            failed += 1

    print("\n" + "=" * 70)
    print(f"COMPLETE: {downloaded} downloaded, {skipped} skipped, {failed} failed")
    print("=" * 70)


if __name__ == "__main__":
    main()
