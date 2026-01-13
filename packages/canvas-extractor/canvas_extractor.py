#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "browser_cookie3"]
# ///
"""
Canvas LMS Content Extractor
Downloads all modules, files, pages, and announcements from Canvas LMS.
Supports incremental downloads - only fetches new/updated content.
Also downloads files linked in HTML content (including videos from gu.se).
"""

import json
import os
import re
import hashlib
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, asdict, field
from urllib.parse import urlparse, urljoin, unquote

from bs4 import BeautifulSoup
import browser_cookie3

# Configuration
CANVAS_BASE_URL = "https://canvas.gu.se/api/v1"
CANVAS_TOKEN = "12237~HFeZeAfLEaN6XUD2a6rE6hk4KNFhFhN2Fyt7z7FkcXTm2BZ9CVJrkPMY3VFHGCCk"
OUTPUT_DIR = Path(__file__).parent / "canvas-lms"
STATE_FILE = OUTPUT_DIR / ".sync_state.json"


@dataclass
class SyncState:
    """Tracks what has been downloaded for incremental sync"""
    last_sync: str = ""
    downloaded_files: dict = None
    downloaded_pages: dict = None
    downloaded_announcements: dict = None
    downloaded_linked_files: dict = None  # Track files extracted from HTML links

    def __post_init__(self):
        if self.downloaded_files is None:
            self.downloaded_files = {}
        if self.downloaded_pages is None:
            self.downloaded_pages = {}
        if self.downloaded_announcements is None:
            self.downloaded_announcements = {}
        if self.downloaded_linked_files is None:
            self.downloaded_linked_files = {}


def load_state() -> SyncState:
    """Load sync state from disk"""
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text())
            return SyncState(**data)
        except Exception as e:
            print(f"Warning: Could not load state file: {e}")
    return SyncState()


def save_state(state: SyncState):
    """Save sync state to disk"""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(asdict(state), indent=2))


def canvas_request(endpoint: str, params: dict = None) -> requests.Response:
    """Make authenticated request to Canvas API"""
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {CANVAS_TOKEN}",
        "Content-Type": "application/json"
    }
    return requests.get(url, headers=headers, params=params)


def canvas_request_all_pages(endpoint: str, params: dict = None) -> list:
    """Fetch all pages of a paginated Canvas API response"""
    results = []
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    params = params or {}
    params["per_page"] = 100

    while url:
        response = canvas_request(url, params if not url.startswith("http") else None)
        if not response.ok:
            print(f"Error fetching {url}: {response.status_code} - {response.text}")
            break

        results.extend(response.json())

        # Check for next page in Link header
        link_header = response.headers.get("Link", "")
        next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
        url = next_match.group(1) if next_match else None
        params = None  # URL already contains params

    return results


def sanitize_filename(name: str) -> str:
    """Convert a name to a safe filename"""
    # Replace problematic characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    # Limit length
    if len(name) > 200:
        name = name[:200]
    return name


def get_courses() -> list:
    """Get all active courses"""
    print("Fetching courses...")
    courses = canvas_request_all_pages("/courses", {"enrollment_state": "active"})
    print(f"Found {len(courses)} courses")
    return courses


def get_modules(course_id: int) -> list:
    """Get all modules for a course"""
    return canvas_request_all_pages(f"/courses/{course_id}/modules")


def get_module_items(course_id: int, module_id: int) -> list:
    """Get all items in a module"""
    return canvas_request_all_pages(f"/courses/{course_id}/modules/{module_id}/items")


def get_page(course_id: int, page_url: str) -> dict:
    """Get a specific page content"""
    response = canvas_request(f"/courses/{course_id}/pages/{page_url}")
    if response.ok:
        return response.json()
    return None


def get_file_metadata(file_id: int) -> dict:
    """Get file metadata"""
    response = canvas_request(f"/files/{file_id}")
    if response.ok:
        return response.json()
    return None


def download_file(url: str, dest_path: Path) -> bool:
    """Download a file from URL"""
    try:
        headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}
        response = requests.get(url, headers=headers, stream=True)
        if response.ok:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"Error downloading file: {e}")
    return False


# Cookie cache to avoid repeated browser database access
_cookie_cache: dict = {}


def get_cookies_for_domain(domain: str) -> dict:
    """Get cookies from Brave browser for a specific domain"""
    if domain in _cookie_cache:
        return _cookie_cache[domain]

    try:
        cj = browser_cookie3.brave(domain_name=domain)
        cookies = {c.name: c.value for c in cj}
        _cookie_cache[domain] = cookies
        return cookies
    except Exception as e:
        print(f"Warning: Could not get cookies for {domain}: {e}")
        return {}


def get_cookies_for_url(url: str) -> dict:
    """Get appropriate cookies for a URL based on its domain"""
    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    # Determine which domain to get cookies for
    if "gu.se" in hostname:
        return get_cookies_for_domain(".gu.se")
    elif "google" in hostname or "youtube" in hostname:
        return get_cookies_for_domain(".google.com")
    elif "microsoft" in hostname or "sharepoint" in hostname:
        return get_cookies_for_domain(".microsoft.com")
    else:
        # Try to get cookies for the specific domain
        return get_cookies_for_domain(f".{hostname.split('.')[-2]}.{hostname.split('.')[-1]}" if hostname.count('.') >= 1 else hostname)


def extract_canvas_file_id(url: str) -> Optional[int]:
    """Extract Canvas file ID from a URL like /courses/X/files/12345?verifier=..."""
    match = re.search(r'/files/(\d+)', url)
    if match:
        return int(match.group(1))
    return None


def extract_links_from_html(html_content: str, base_url: str = "") -> list[dict]:
    """Extract all downloadable links from HTML content"""
    soup = BeautifulSoup(html_content, 'html.parser')
    links = []

    # Extract from <a href> tags - look for Canvas file links
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if not href or href.startswith('#') or href.startswith('javascript:'):
            continue

        # Check for data-api-endpoint (Canvas file links have this)
        api_endpoint = a_tag.get('data-api-endpoint', '')

        # Make absolute URL if needed
        if not href.startswith(('http://', 'https://')):
            if base_url:
                href = urljoin(base_url, href)
            else:
                continue

        # Check if it's a Canvas file link
        file_id = extract_canvas_file_id(href) or extract_canvas_file_id(api_endpoint)
        if file_id:
            link_text = a_tag.get_text(strip=True) or "untitled"
            links.append({
                'url': href,
                'text': link_text,
                'type': 'canvas_file',
                'file_id': file_id
            })
            continue

        # Check for other downloadable files (external)
        parsed = urlparse(href)
        path = parsed.path.lower()

        # File extensions that should be downloaded
        downloadable_extensions = {
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.mp4', '.webm', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.ogg',
            '.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp',
        }

        has_file_ext = any(path.endswith(ext) for ext in downloadable_extensions)

        # Check for video/media hosting URLs
        is_media_url = any(domain in href for domain in [
            'play.gu.se', 'video.gu.se', 'media.gu.se',
        ])

        if has_file_ext or is_media_url:
            link_text = a_tag.get_text(strip=True) or "untitled"
            links.append({
                'url': href,
                'text': link_text,
                'type': 'external',
                'file_id': None
            })

    # Extract from <video> and <source> tags
    for video_tag in soup.find_all(['video', 'source']):
        src = video_tag.get('src')
        if src:
            if not src.startswith(('http://', 'https://')) and base_url:
                src = urljoin(base_url, src)
            file_id = extract_canvas_file_id(src)
            links.append({
                'url': src,
                'text': 'video',
                'type': 'canvas_file' if file_id else 'external',
                'file_id': file_id
            })

    # Extract from <iframe> tags (for embedded videos from gu.se)
    for iframe in soup.find_all('iframe', src=True):
        src = iframe['src']
        if any(domain in src for domain in ['play.gu.se', 'video.gu.se']):
            links.append({
                'url': src,
                'text': 'embedded video',
                'type': 'external',
                'file_id': None
            })

    # Deduplicate by file_id (for canvas files) or URL (for external)
    seen_ids = set()
    seen_urls = set()
    unique_links = []
    for link in links:
        if link['file_id']:
            if link['file_id'] not in seen_ids:
                seen_ids.add(link['file_id'])
                unique_links.append(link)
        else:
            if link['url'] not in seen_urls:
                seen_urls.add(link['url'])
                unique_links.append(link)

    return unique_links


def get_filename_from_url(url: str, link_text: str = "") -> str:
    """Extract a filename from URL or generate one"""
    parsed = urlparse(url)
    path = unquote(parsed.path)

    # Try to get filename from path
    if '/' in path:
        filename = path.split('/')[-1]
        if filename and '.' in filename:
            return sanitize_filename(filename)

    # Try to use link text
    if link_text and link_text != "untitled":
        # Add extension if missing
        return sanitize_filename(link_text)

    # Generate hash-based name
    return f"file_{hashlib.md5(url.encode()).hexdigest()[:8]}"


def download_external_file(url: str, dest_path: Path, state: SyncState) -> bool:
    """Download a file from an external URL using browser cookies"""
    state_key = hashlib.md5(url.encode()).hexdigest()

    # Check if already downloaded
    if state_key in state.downloaded_linked_files and dest_path.exists():
        return True

    try:
        cookies = get_cookies_for_url(url)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        # For Canvas URLs, also include the auth token
        if 'canvas.gu.se' in url:
            headers['Authorization'] = f'Bearer {CANVAS_TOKEN}'

        response = requests.get(url, headers=headers, cookies=cookies, stream=True, timeout=60, allow_redirects=True)

        if response.ok:
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Check content type for proper extension
            content_type = response.headers.get('Content-Type', '')

            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            state.downloaded_linked_files[state_key] = url
            return True
        else:
            print(f"      Failed to download {url}: {response.status_code}")
            return False

    except Exception as e:
        print(f"      Error downloading {url}: {e}")
        return False


def download_canvas_linked_file(file_id: int, dest_dir: Path, state: SyncState) -> bool:
    """Download a Canvas file by its ID"""
    state_key = f"canvas_file_{file_id}"

    # Get file metadata from Canvas API
    file_meta = get_file_metadata(file_id)
    if not file_meta:
        print(f"        Could not get metadata for file {file_id}")
        return False

    filename = sanitize_filename(file_meta.get("display_name", f"file_{file_id}"))
    dest_path = dest_dir / filename

    # Check if already downloaded and unchanged
    file_updated = file_meta.get("updated_at", "")
    if state_key in state.downloaded_linked_files:
        if state.downloaded_linked_files[state_key] == file_updated and dest_path.exists():
            return True

    # Get download URL and download
    file_url = file_meta.get("url")
    if not file_url:
        print(f"        No download URL for file {file_id}")
        return False

    print(f"      Downloading: {filename}")
    if download_file(file_url, dest_path):
        state.downloaded_linked_files[state_key] = file_updated
        print(f"        (downloaded: {dest_path.stat().st_size / 1024 / 1024:.1f} MB)")
        return True
    else:
        print(f"        (download failed)")
        return False


def download_linked_files(html_content: str, dest_dir: Path, state: SyncState, base_url: str = ""):
    """Extract and download all linked files from HTML content"""
    links = extract_links_from_html(html_content, base_url)

    if not links:
        return

    print(f"      Found {len(links)} linked files")

    for link in links:
        url = link['url']
        link_text = link['text']
        link_type = link['type']
        file_id = link.get('file_id')

        if link_type == 'canvas_file' and file_id:
            # Download Canvas file using API
            download_canvas_linked_file(file_id, dest_dir, state)
        else:
            # External file - create linked_files subdirectory
            files_dir = dest_dir / "_linked_files"
            files_dir.mkdir(parents=True, exist_ok=True)

            filename = get_filename_from_url(url, link_text)
            dest_path = files_dir / filename

            # Skip if already downloaded
            state_key = hashlib.md5(url.encode()).hexdigest()
            if state_key in state.downloaded_linked_files and dest_path.exists():
                continue

            print(f"      Downloading external: {filename}")
            if download_external_file(url, dest_path, state):
                print(f"        (downloaded)")
            else:
                # Save URL info for manual download
                url_info = files_dir / f"{filename}.url.json"
                url_info.write_text(json.dumps(link, indent=2))


def get_announcements(course_id: int) -> list:
    """Get all announcements for a course"""
    return canvas_request_all_pages(
        f"/courses/{course_id}/discussion_topics",
        {"only_announcements": "true"}
    )


def get_discussion_entries(course_id: int, topic_id: int) -> list:
    """Get all entries in a discussion/announcement"""
    return canvas_request_all_pages(
        f"/courses/{course_id}/discussion_topics/{topic_id}/entries"
    )


def extract_course(course: dict, state: SyncState):
    """Extract all content from a course"""
    course_id = course["id"]
    course_name = sanitize_filename(course.get("name", f"course_{course_id}"))
    course_dir = OUTPUT_DIR / course_name

    print(f"\n{'='*60}")
    print(f"Processing course: {course_name}")
    print(f"{'='*60}")

    # Create course directory
    course_dir.mkdir(parents=True, exist_ok=True)

    # Save course metadata
    metadata_file = course_dir / "_course_info.json"
    metadata_file.write_text(json.dumps(course, indent=2, ensure_ascii=False))

    # Extract modules and their content
    extract_modules(course_id, course_dir, state)

    # Extract announcements
    extract_announcements(course_id, course_dir, state)


def extract_modules(course_id: int, course_dir: Path, state: SyncState):
    """Extract all modules and their content from a course"""
    modules = get_modules(course_id)
    print(f"Found {len(modules)} modules")

    modules_dir = course_dir / "modules"
    modules_dir.mkdir(parents=True, exist_ok=True)

    for module in modules:
        module_id = module["id"]
        module_name = sanitize_filename(module.get("name", f"module_{module_id}"))
        module_dir = modules_dir / f"{module.get('position', 0):02d}_{module_name}"
        module_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n  Module: {module_name}")

        # Save module metadata
        (module_dir / "_module_info.json").write_text(
            json.dumps(module, indent=2, ensure_ascii=False)
        )

        # Get and process module items
        items = get_module_items(course_id, module_id)

        for item in items:
            extract_module_item(course_id, item, module_dir, state)


def extract_module_item(course_id: int, item: dict, module_dir: Path, state: SyncState):
    """Extract a single module item"""
    item_type = item.get("type")
    item_title = sanitize_filename(item.get("title", "untitled"))
    item_id = item.get("id")

    if item_type == "SubHeader":
        # Just a header, skip
        return

    print(f"    - [{item_type}] {item_title}")

    if item_type == "Page":
        extract_page(course_id, item, module_dir, state)
    elif item_type == "File":
        extract_file(item, module_dir, state)
    elif item_type == "ExternalUrl":
        # Save external URL info
        url_file = module_dir / f"{item_title}.url.json"
        url_file.write_text(json.dumps({
            "title": item.get("title"),
            "url": item.get("external_url"),
            "item": item
        }, indent=2, ensure_ascii=False))
    elif item_type in ("Assignment", "Quiz", "Discussion"):
        # Save reference info
        ref_file = module_dir / f"{item_title}.{item_type.lower()}.json"
        ref_file.write_text(json.dumps(item, indent=2, ensure_ascii=False))


def extract_page(course_id: int, item: dict, module_dir: Path, state: SyncState):
    """Extract a Canvas page"""
    page_url = item.get("page_url")
    if not page_url:
        return

    state_key = f"{course_id}_{page_url}"
    item_title = sanitize_filename(item.get("title", "untitled"))

    page = get_page(course_id, page_url)
    if not page:
        return

    # Check if page has been updated
    updated_at = page.get("updated_at", "")
    if state_key in state.downloaded_pages:
        if state.downloaded_pages[state_key] == updated_at:
            print(f"      (skipped - unchanged)")
            return

    # Save page content
    page_file = module_dir / f"{item_title}.html"
    body = page.get("body", "")

    # Create a full HTML document
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{page.get('title', item_title)}</title>
</head>
<body>
{body}
</body>
</html>"""

    page_file.write_text(html_content, encoding="utf-8")

    # Save page metadata
    meta_file = module_dir / f"{item_title}.page.json"
    meta_file.write_text(json.dumps(page, indent=2, ensure_ascii=False))

    # Download linked files from the HTML content
    if body:
        base_url = f"https://canvas.gu.se/courses/{course_id}/pages/{page_url}"
        download_linked_files(body, module_dir, state, base_url)

    # Update state
    state.downloaded_pages[state_key] = updated_at


def extract_file(item: dict, module_dir: Path, state: SyncState):
    """Extract a file from Canvas"""
    content_id = item.get("content_id")
    if not content_id:
        return

    file_meta = get_file_metadata(content_id)
    if not file_meta:
        return

    filename = sanitize_filename(file_meta.get("display_name", f"file_{content_id}"))
    file_path = module_dir / filename

    # Check if file needs downloading
    state_key = str(content_id)
    file_updated = file_meta.get("updated_at", "")

    if state_key in state.downloaded_files:
        if state.downloaded_files[state_key] == file_updated and file_path.exists():
            print(f"      (skipped - unchanged)")
            return

    # Download file
    file_url = file_meta.get("url")
    if file_url and download_file(file_url, file_path):
        state.downloaded_files[state_key] = file_updated
        print(f"      (downloaded)")
    else:
        print(f"      (download failed)")


def extract_announcements(course_id: int, course_dir: Path, state: SyncState):
    """Extract all announcements from a course"""
    announcements = get_announcements(course_id)
    if not announcements:
        return

    print(f"\nFound {len(announcements)} announcements")

    announcements_dir = course_dir / "announcements"
    announcements_dir.mkdir(parents=True, exist_ok=True)

    for announcement in announcements:
        ann_id = announcement.get("id")
        ann_title = sanitize_filename(announcement.get("title", f"announcement_{ann_id}"))
        posted_at = announcement.get("posted_at", "")

        state_key = f"{course_id}_{ann_id}"

        # Check if announcement has been updated
        if state_key in state.downloaded_announcements:
            if state.downloaded_announcements[state_key] == posted_at:
                continue

        print(f"  - {ann_title}")

        # Get full content including replies
        entries = get_discussion_entries(course_id, ann_id)

        # Save announcement
        ann_data = {
            "announcement": announcement,
            "entries": entries
        }

        # Create date prefix for sorting
        if posted_at:
            try:
                date = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
                date_prefix = date.strftime("%Y-%m-%d")
            except:
                date_prefix = "0000-00-00"
        else:
            date_prefix = "0000-00-00"

        ann_file = announcements_dir / f"{date_prefix}_{ann_title}.json"
        ann_file.write_text(json.dumps(ann_data, indent=2, ensure_ascii=False))

        # Also save as HTML for easy reading
        message = announcement.get("message", "")
        html_file = announcements_dir / f"{date_prefix}_{ann_title}.html"
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{announcement.get('title', ann_title)}</title>
</head>
<body>
<h1>{announcement.get('title', ann_title)}</h1>
<p><em>Posted: {posted_at}</em></p>
<hr>
{message}
</body>
</html>"""
        html_file.write_text(html_content, encoding="utf-8")

        # Download linked files from the announcement HTML content
        if message:
            base_url = f"https://canvas.gu.se/courses/{course_id}/discussion_topics/{ann_id}"
            download_linked_files(message, announcements_dir, state, base_url)

        state.downloaded_announcements[state_key] = posted_at


def main():
    print("Canvas LMS Content Extractor")
    print("="*60)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Base URL: {CANVAS_BASE_URL}")

    # Load sync state for incremental downloads
    state = load_state()
    if state.last_sync:
        print(f"Last sync: {state.last_sync}")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get all courses
    courses = get_courses()

    # Process each course
    for course in courses:
        try:
            extract_course(course, state)
        except Exception as e:
            print(f"Error processing course {course.get('name')}: {e}")
            import traceback
            traceback.print_exc()

    # Update sync timestamp
    state.last_sync = datetime.now().isoformat()
    save_state(state)

    print("\n" + "="*60)
    print("Extraction complete!")
    print(f"Content saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
