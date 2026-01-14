#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4"]
# ///
"""
List all files that would be downloaded from Canvas LPG001 courses.
Downloads HTML pages but only lists attachments for verification.
"""

import json
import re
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from dataclasses import dataclass, field
from typing import Optional

# Configuration
CANVAS_BASE_URL = "https://canvas.gu.se/api/v1"
CANVAS_TOKEN = "12237~HFeZeAfLEaN6XUD2a6rE6hk4KNFhFhN2Fyt7z7FkcXTm2BZ9CVJrkPMY3VFHGCCk"
OUTPUT_DIR = Path(__file__).parent / "canvas-lms"

# LPG001 course IDs
LPG001_COURSES = [86180, 91586]


@dataclass
class FileToDownload:
    file_id: int
    filename: str
    size_bytes: int
    course: str
    source: str  # e.g. "page: CNS Anatomi" or "module file"

    @property
    def size_mb(self) -> float:
        return self.size_bytes / 1024 / 1024


def canvas_request(endpoint: str, params: dict = None) -> requests.Response:
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}
    return requests.get(url, headers=headers, params=params)


def canvas_request_all_pages(endpoint: str, params: dict = None) -> list:
    results = []
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    params = params or {}
    params["per_page"] = 100

    while url:
        response = canvas_request(url, params if not url.startswith("http") else None)
        if not response.ok:
            print(f"Error fetching {url}: {response.status_code}")
            break
        results.extend(response.json())
        link_header = response.headers.get("Link", "")
        next_match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
        url = next_match.group(1) if next_match else None
        params = None
    return results


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:200] if len(name) > 200 else name


def extract_canvas_file_id(url: str) -> Optional[int]:
    match = re.search(r'/files/(\d+)', url)
    return int(match.group(1)) if match else None


def extract_file_ids_from_html(html_content: str) -> set[int]:
    """Extract all Canvas file IDs from HTML content"""
    if not html_content:
        return set()
    soup = BeautifulSoup(html_content, 'html.parser')
    file_ids = set()

    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        api_endpoint = a_tag.get('data-api-endpoint', '')

        file_id = extract_canvas_file_id(href) or extract_canvas_file_id(api_endpoint)
        if file_id:
            file_ids.add(file_id)

    return file_ids


def get_file_metadata(file_id: int) -> Optional[dict]:
    response = canvas_request(f"/files/{file_id}")
    return response.json() if response.ok else None


def process_course(course_id: int, all_files: dict[int, FileToDownload]):
    """Process a single course and collect all files"""

    # Get course info
    resp = canvas_request(f"/courses/{course_id}")
    if not resp.ok:
        print(f"Could not fetch course {course_id}")
        return

    course = resp.json()
    course_name = course.get("name", f"Course {course_id}")
    course_code = course.get("course_code", "")
    course_dir = OUTPUT_DIR / sanitize_filename(course_name)

    print(f"\n{'='*70}")
    print(f"Course: {course_code} - {course_name}")
    print(f"{'='*70}")

    # Save course metadata
    course_dir.mkdir(parents=True, exist_ok=True)
    (course_dir / "_course_info.json").write_text(json.dumps(course, indent=2, ensure_ascii=False))

    # Get modules
    modules = canvas_request_all_pages(f"/courses/{course_id}/modules")
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
        (module_dir / "_module_info.json").write_text(json.dumps(module, indent=2, ensure_ascii=False))

        # Get module items
        items = canvas_request_all_pages(f"/courses/{course_id}/modules/{module_id}/items")

        for item in items:
            item_type = item.get("type")
            item_title = sanitize_filename(item.get("title", "untitled"))

            if item_type == "SubHeader":
                continue

            print(f"    - [{item_type}] {item_title}")

            if item_type == "Page":
                # Fetch and save page HTML
                page_url = item.get("page_url")
                if page_url:
                    resp = canvas_request(f"/courses/{course_id}/pages/{page_url}")
                    if resp.ok:
                        page = resp.json()
                        body = page.get("body") or ""

                        # Save HTML
                        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{page.get('title', item_title)}</title></head>
<body>{body}</body>
</html>"""
                        (module_dir / f"{item_title}.html").write_text(html_content, encoding="utf-8")

                        # Extract file IDs from HTML
                        file_ids = extract_file_ids_from_html(body)
                        for fid in file_ids:
                            if fid not in all_files:
                                meta = get_file_metadata(fid)
                                if meta:
                                    all_files[fid] = FileToDownload(
                                        file_id=fid,
                                        filename=meta.get("display_name", f"file_{fid}"),
                                        size_bytes=meta.get("size", 0),
                                        course=course_code,
                                        source=f"page: {item_title}"
                                    )

            elif item_type == "File":
                content_id = item.get("content_id")
                if content_id and content_id not in all_files:
                    meta = get_file_metadata(content_id)
                    if meta:
                        all_files[content_id] = FileToDownload(
                            file_id=content_id,
                            filename=meta.get("display_name", f"file_{content_id}"),
                            size_bytes=meta.get("size", 0),
                            course=course_code,
                            source=f"module: {module_name}"
                        )

            elif item_type == "ExternalUrl":
                url_data = {"title": item.get("title"), "url": item.get("external_url"), "item": item}
                (module_dir / f"{item_title}.url.json").write_text(json.dumps(url_data, indent=2, ensure_ascii=False))

            elif item_type in ("Assignment", "Quiz", "Discussion"):
                (module_dir / f"{item_title}.{item_type.lower()}.json").write_text(
                    json.dumps(item, indent=2, ensure_ascii=False)
                )

    # Get announcements
    announcements = canvas_request_all_pages(f"/courses/{course_id}/discussion_topics", {"only_announcements": "true"})
    if announcements:
        print(f"\n  Announcements: {len(announcements)}")
        ann_dir = course_dir / "announcements"
        ann_dir.mkdir(parents=True, exist_ok=True)

        for ann in announcements:
            ann_id = ann.get("id")
            ann_title = sanitize_filename(ann.get("title", f"announcement_{ann_id}"))
            message = ann.get("message", "")
            posted_at = ann.get("posted_at", "")

            # Save HTML
            html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{ann.get('title', ann_title)}</title></head>
<body><h1>{ann.get('title', ann_title)}</h1><p><em>Posted: {posted_at}</em></p><hr>{message}</body>
</html>"""

            date_prefix = "0000-00-00"
            if posted_at:
                try:
                    from datetime import datetime
                    date = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
                    date_prefix = date.strftime("%Y-%m-%d")
                except:
                    pass

            (ann_dir / f"{date_prefix}_{ann_title}.html").write_text(html_content, encoding="utf-8")

            # Extract file IDs from announcement
            file_ids = extract_file_ids_from_html(message)
            for fid in file_ids:
                if fid not in all_files:
                    meta = get_file_metadata(fid)
                    if meta:
                        all_files[fid] = FileToDownload(
                            file_id=fid,
                            filename=meta.get("display_name", f"file_{fid}"),
                            size_bytes=meta.get("size", 0),
                            course=course_code,
                            source=f"announcement: {ann_title[:30]}"
                        )


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


def download_all_files(all_files: dict[int, FileToDownload]):
    """Download all collected files"""
    files_dir = OUTPUT_DIR / "_files"
    files_dir.mkdir(parents=True, exist_ok=True)

    sorted_files = sorted(all_files.values(), key=lambda f: (f.course, f.filename))

    total = len(sorted_files)
    downloaded = 0
    skipped = 0
    failed = 0

    for i, f in enumerate(sorted_files, 1):
        dest_path = files_dir / sanitize_filename(f.filename)

        # Skip if already exists with correct size
        if dest_path.exists() and dest_path.stat().st_size == f.size_bytes:
            skipped += 1
            continue

        # Get download URL from API
        meta = get_file_metadata(f.file_id)
        if not meta or not meta.get("url"):
            print(f"[{i}/{total}] FAILED (no URL): {f.filename}")
            failed += 1
            continue

        size_str = f"{f.size_mb:.1f} MB" if f.size_mb >= 1 else f"{f.size_bytes/1024:.0f} KB"
        print(f"[{i}/{total}] Downloading: {f.filename} ({size_str})")

        if download_file(meta["url"], dest_path):
            downloaded += 1
        else:
            failed += 1
            print(f"  FAILED!")

    print(f"\n{'='*70}")
    print(f"DOWNLOAD COMPLETE: {downloaded} downloaded, {skipped} skipped, {failed} failed")
    print(f"{'='*70}")


def main():
    print("Canvas LPG001 File Downloader")
    print("="*70)
    print(f"Output directory: {OUTPUT_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_files: dict[int, FileToDownload] = {}

    for course_id in LPG001_COURSES:
        process_course(course_id, all_files)

    # Print summary of files to download
    print("\n")
    print("="*70)
    print(f"DOWNLOADING {len(all_files)} FILES")
    print("="*70)

    download_all_files(all_files)

    total_size = sum(f.size_bytes for f in all_files.values())
    print(f"\nTotal: {len(all_files)} files, {total_size/1024/1024/1024:.2f} GB")


if __name__ == "__main__":
    main()
