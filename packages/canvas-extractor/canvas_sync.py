#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "browser_cookie3"]
# ///
"""
Incremental Canvas LMS sync for LPG001 courses.
Downloads pages, files, announcements, conversations, and videos.
Designed to be run hourly via cron.

Usage:
    uv run canvas_sync.py           # Full sync
    uv run canvas_sync.py --status  # Show sync status
    uv run canvas_sync.py --reset   # Reset sync state
"""

import json
import re
import sys
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional
import browser_cookie3

# Configuration
CANVAS_BASE_URL = "https://canvas.gu.se/api/v1"
CANVAS_TOKEN = "12237~HFeZeAfLEaN6XUD2a6rE6hk4KNFhFhN2Fyt7z7FkcXTm2BZ9CVJrkPMY3VFHGCCk"
OUTPUT_DIR = Path(__file__).parent / "canvas-lms"
STATE_FILE = OUTPUT_DIR / "_sync_state.json"

# LPG001 course IDs
LPG001_COURSES = [86180, 91586]


@dataclass
class SyncState:
    last_sync: Optional[str] = None
    files_downloaded: dict = None
    videos_downloaded: dict = None
    conversations_synced: dict = None
    announcements_synced: dict = None
    pages_synced: dict = None

    def __post_init__(self):
        self.files_downloaded = self.files_downloaded or {}
        self.videos_downloaded = self.videos_downloaded or {}
        self.conversations_synced = self.conversations_synced or {}
        self.announcements_synced = self.announcements_synced or {}
        self.pages_synced = self.pages_synced or {}


def load_state() -> SyncState:
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text())
            return SyncState(**data)
        except:
            pass
    return SyncState()


def save_state(state: SyncState):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(asdict(state), indent=2, ensure_ascii=False))


def canvas_request(endpoint: str, params: dict = None) -> requests.Response:
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}
    return requests.get(url, headers=headers, params=params, timeout=30)


def canvas_request_all_pages(endpoint: str, params: dict = None) -> list:
    results = []
    url = endpoint if endpoint.startswith("http") else f"{CANVAS_BASE_URL}{endpoint}"
    params = params or {}
    params["per_page"] = 100

    while url:
        response = canvas_request(url, params if not url.startswith("http") else None)
        if not response.ok:
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


def extract_kaltura_ids_from_html(html_content: str) -> set[str]:
    """Extract Kaltura video entry IDs from HTML"""
    if not html_content:
        return set()
    ids = set()
    # Pattern for play.gu.se iframes with entryId parameter
    for match in re.finditer(r'play\.gu\.se/[^"\']*entryId/([0-9]_[a-z0-9]+)', html_content):
        ids.add(match.group(1))
    # Pattern for play.gu.se/media/ direct links (entry ID at end of URL)
    for match in re.finditer(r'play\.gu\.se/media/[^"\']+/([0-9]_[a-z0-9]+)', html_content):
        ids.add(match.group(1))
    # Pattern for data attributes
    for match in re.finditer(r'data-entry[_-]?id=["\']([0-9]_[a-z0-9]+)["\']', html_content):
        ids.add(match.group(1))
    return ids


def get_file_metadata(file_id: int) -> Optional[dict]:
    response = canvas_request(f"/files/{file_id}")
    return response.json() if response.ok else None


def download_file(url: str, dest_path: Path) -> bool:
    try:
        headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}
        response = requests.get(url, headers=headers, stream=True, timeout=300)
        if response.ok:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"    Error: {e}")
    return False


# ============================================================================
# Conversations (Inbox Messages)
# ============================================================================

def sync_conversations(state: SyncState):
    """Sync inbox conversations"""
    print("\n" + "="*70)
    print("SYNCING CONVERSATIONS (Inbox)")
    print("="*70)

    conv_dir = OUTPUT_DIR / "_conversations"
    conv_dir.mkdir(parents=True, exist_ok=True)

    # Get all conversations
    conversations = canvas_request_all_pages("/conversations", {"scope": "inbox"})
    print(f"Found {len(conversations)} conversations")

    new_count = 0
    updated_count = 0

    for conv in conversations:
        conv_id = str(conv.get("id"))
        last_message = conv.get("last_message_at", "")

        # Check if we need to sync this conversation
        if conv_id in state.conversations_synced:
            if state.conversations_synced[conv_id] == last_message:
                continue  # No new messages
            updated_count += 1
        else:
            new_count += 1

        # Get full conversation with messages
        resp = canvas_request(f"/conversations/{conv_id}")
        if not resp.ok:
            continue

        full_conv = resp.json()

        subject = sanitize_filename(full_conv.get("subject", f"conversation_{conv_id}"))
        participants = full_conv.get("participants", [])
        messages = full_conv.get("messages", [])

        # Build HTML for conversation
        participant_names = ", ".join(p.get("name", "Unknown") for p in participants)

        messages_html = ""
        for msg in reversed(messages):  # Oldest first
            author = msg.get("author_id")
            author_name = next((p.get("name") for p in participants if p.get("id") == author), "Unknown")
            created = msg.get("created_at", "")
            body = msg.get("body", "")

            # Format date
            date_str = ""
            if created:
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    date_str = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    date_str = created

            messages_html += f"""
            <div style="margin: 1em 0; padding: 1em; border: 1px solid #ddd; border-radius: 5px;">
                <div style="font-weight: bold; color: #333;">{author_name}</div>
                <div style="font-size: 0.8em; color: #666;">{date_str}</div>
                <div style="margin-top: 0.5em;">{body}</div>
            </div>
            """

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{subject}</title>
    <style>
        body {{ font-family: sans-serif; max-width: 800px; margin: 2em auto; padding: 1em; }}
        h1 {{ color: #333; }}
        .participants {{ color: #666; margin-bottom: 1em; }}
    </style>
</head>
<body>
    <h1>{subject}</h1>
    <div class="participants">Participants: {participant_names}</div>
    <hr>
    {messages_html}
</body>
</html>"""

        # Get date for filename
        date_prefix = "0000-00-00"
        if last_message:
            try:
                dt = datetime.fromisoformat(last_message.replace("Z", "+00:00"))
                date_prefix = dt.strftime("%Y-%m-%d")
            except:
                pass

        filename = f"{date_prefix}_{subject[:80]}.html"
        (conv_dir / sanitize_filename(filename)).write_text(html_content, encoding="utf-8")

        # Also save raw JSON
        (conv_dir / f"{conv_id}.json").write_text(json.dumps(full_conv, indent=2, ensure_ascii=False))

        state.conversations_synced[conv_id] = last_message
        print(f"  {'Updated' if conv_id in state.conversations_synced else 'New'}: {subject[:50]}...")

    print(f"Conversations: {new_count} new, {updated_count} updated")
    return new_count + updated_count


# ============================================================================
# Course Content (Pages, Announcements, Files)
# ============================================================================

def sync_course(course_id: int, state: SyncState, all_files: dict, all_kaltura_ids: set):
    """Sync a single course"""
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

    course_dir.mkdir(parents=True, exist_ok=True)
    (course_dir / "_course_info.json").write_text(json.dumps(course, indent=2, ensure_ascii=False))

    # Sync modules and pages
    modules = canvas_request_all_pages(f"/courses/{course_id}/modules")
    print(f"Found {len(modules)} modules")

    modules_dir = course_dir / "modules"
    modules_dir.mkdir(parents=True, exist_ok=True)

    for module in modules:
        module_id = module["id"]
        module_name = sanitize_filename(module.get("name", f"module_{module_id}"))
        module_dir = modules_dir / f"{module.get('position', 0):02d}_{module_name}"
        module_dir.mkdir(parents=True, exist_ok=True)

        (module_dir / "_module_info.json").write_text(json.dumps(module, indent=2, ensure_ascii=False))

        items = canvas_request_all_pages(f"/courses/{course_id}/modules/{module_id}/items")

        for item in items:
            item_type = item.get("type")
            item_title = sanitize_filename(item.get("title", "untitled"))

            if item_type == "SubHeader":
                continue

            if item_type == "Page":
                page_url = item.get("page_url")
                if page_url:
                    page_key = f"{course_id}:{page_url}"

                    # Check if page was updated
                    resp = canvas_request(f"/courses/{course_id}/pages/{page_url}")
                    if resp.ok:
                        page = resp.json()
                        updated_at = page.get("updated_at", "")
                        body = page.get("body") or ""

                        # Skip if not updated
                        if page_key in state.pages_synced and state.pages_synced[page_key] == updated_at:
                            # Still extract file IDs from body
                            file_ids = extract_file_ids_from_html(body)
                            for fid in file_ids:
                                if fid not in all_files:
                                    all_files[fid] = {"source": f"page: {item_title}", "course": course_code}
                            kaltura_ids = extract_kaltura_ids_from_html(body)
                            all_kaltura_ids.update(kaltura_ids)
                            continue

                        html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{page.get('title', item_title)}</title></head>
<body>{body}</body>
</html>"""
                        (module_dir / f"{item_title}.html").write_text(html_content, encoding="utf-8")

                        # Extract files and videos
                        file_ids = extract_file_ids_from_html(body)
                        for fid in file_ids:
                            if fid not in all_files:
                                all_files[fid] = {"source": f"page: {item_title}", "course": course_code}

                        kaltura_ids = extract_kaltura_ids_from_html(body)
                        all_kaltura_ids.update(kaltura_ids)

                        state.pages_synced[page_key] = updated_at
                        print(f"    [Page] {item_title}")

            elif item_type == "File":
                content_id = item.get("content_id")
                if content_id and content_id not in all_files:
                    all_files[content_id] = {"source": f"module: {module_name}", "course": course_code}

            elif item_type == "ExternalUrl":
                url_data = {"title": item.get("title"), "url": item.get("external_url"), "item": item}
                (module_dir / f"{item_title}.url.json").write_text(json.dumps(url_data, indent=2, ensure_ascii=False))

            elif item_type in ("Assignment", "Quiz", "Discussion"):
                (module_dir / f"{item_title}.{item_type.lower()}.json").write_text(
                    json.dumps(item, indent=2, ensure_ascii=False)
                )

    # Sync announcements
    announcements = canvas_request_all_pages(f"/courses/{course_id}/discussion_topics", {"only_announcements": "true"})
    if announcements:
        ann_dir = course_dir / "announcements"
        ann_dir.mkdir(parents=True, exist_ok=True)

        new_ann = 0
        for ann in announcements:
            ann_id = str(ann.get("id"))
            posted_at = ann.get("posted_at", "")

            ann_key = f"{course_id}:{ann_id}"
            if ann_key in state.announcements_synced and state.announcements_synced[ann_key] == posted_at:
                continue

            ann_title = sanitize_filename(ann.get("title", f"announcement_{ann_id}"))
            message = ann.get("message", "")

            html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{ann.get('title', ann_title)}</title></head>
<body><h1>{ann.get('title', ann_title)}</h1><p><em>Posted: {posted_at}</em></p><hr>{message}</body>
</html>"""

            date_prefix = "0000-00-00"
            if posted_at:
                try:
                    date = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
                    date_prefix = date.strftime("%Y-%m-%d")
                except:
                    pass

            (ann_dir / f"{date_prefix}_{ann_title}.html").write_text(html_content, encoding="utf-8")

            # Extract files
            file_ids = extract_file_ids_from_html(message)
            for fid in file_ids:
                if fid not in all_files:
                    all_files[fid] = {"source": f"announcement: {ann_title[:30]}", "course": course_code}

            state.announcements_synced[ann_key] = posted_at
            new_ann += 1

        if new_ann:
            print(f"  Announcements: {new_ann} new")


# ============================================================================
# File Downloads
# ============================================================================

def sync_files(all_files: dict, state: SyncState):
    """Download all new files"""
    print("\n" + "="*70)
    print("SYNCING FILES")
    print("="*70)

    files_dir = OUTPUT_DIR / "_files"
    files_dir.mkdir(parents=True, exist_ok=True)

    new_files = 0
    skipped = 0
    failed = 0

    for file_id, info in all_files.items():
        file_id_str = str(file_id)

        # Check if already downloaded
        if file_id_str in state.files_downloaded:
            skipped += 1
            continue

        # Get file metadata
        meta = get_file_metadata(file_id)
        if not meta:
            failed += 1
            continue

        filename = sanitize_filename(meta.get("display_name", f"file_{file_id}"))
        size = meta.get("size", 0)
        dest_path = files_dir / filename

        # Skip if file exists with correct size
        if dest_path.exists() and dest_path.stat().st_size == size:
            state.files_downloaded[file_id_str] = {"filename": filename, "size": size}
            skipped += 1
            continue

        url = meta.get("url")
        if not url:
            failed += 1
            continue

        size_str = f"{size/1024/1024:.1f} MB" if size >= 1024*1024 else f"{size/1024:.0f} KB"
        print(f"  Downloading: {filename} ({size_str})")

        if download_file(url, dest_path):
            state.files_downloaded[file_id_str] = {"filename": filename, "size": size}
            new_files += 1
        else:
            failed += 1

    print(f"Files: {new_files} downloaded, {skipped} skipped, {failed} failed")


# ============================================================================
# Kaltura Video Downloads
# ============================================================================

def get_gu_session():
    """Get session with GU cookies from Brave"""
    session = requests.Session()
    try:
        cj = browser_cookie3.brave(domain_name='.gu.se')
        for cookie in cj:
            session.cookies.set(cookie.name, cookie.value, domain=cookie.domain)
    except Exception as e:
        print(f"Warning: Could not get cookies: {e}")
    return session


def get_kaltura_ks(session, entry_id):
    """Get Kaltura session token from embed page"""
    url = f"https://play.gu.se/embed/secure/iframe/entryId/{entry_id}/uiConfId/23450401"
    resp = session.get(url, allow_redirects=True, timeout=30)
    if not resp.ok:
        return None, None

    ks_match = re.search(r'flashvars\[ks\]=([^&"\']+)', resp.text)
    ks = ks_match.group(1) if ks_match else None

    title_match = re.search(r'title="([^"]+)"', resp.text)
    title = title_match.group(1) if title_match else entry_id

    return ks, title


def download_kaltura_video(session, entry_id, ks, dest_path):
    """Download Kaltura video using direct URL"""
    url = f"https://api.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/url/protocol/https/ks/{ks}"

    try:
        resp = session.get(url, stream=True, timeout=300)
        if not resp.ok:
            return False

        total = int(resp.headers.get('content-length', 0))
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(dest_path, 'wb') as f:
            downloaded = 0
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    print(f"\r    Progress: {pct}%", end='', flush=True)
        print()
        return True
    except Exception as e:
        print(f"\n    Error: {e}")
        return False


def sync_kaltura_videos(kaltura_ids: set, state: SyncState):
    """Sync Kaltura videos"""
    if not kaltura_ids:
        return

    print("\n" + "="*70)
    print("SYNCING KALTURA VIDEOS")
    print("="*70)

    videos_dir = OUTPUT_DIR / "_videos"
    videos_dir.mkdir(parents=True, exist_ok=True)

    # Also load videos from saved JSON if exists
    videos_json = videos_dir / "play_gu_videos.json"
    if videos_json.exists():
        try:
            saved_videos = json.loads(videos_json.read_text())
            for v in saved_videos:
                if 'entry_id' in v:
                    kaltura_ids.add(v['entry_id'])
        except:
            pass

    print(f"Found {len(kaltura_ids)} Kaltura videos")

    session = get_gu_session()

    new_videos = 0
    skipped = 0
    failed = 0

    for entry_id in sorted(kaltura_ids):
        if entry_id in state.videos_downloaded:
            skipped += 1
            continue

        ks, title = get_kaltura_ks(session, entry_id)
        if not ks:
            print(f"  {entry_id}: Could not get KS token")
            failed += 1
            continue

        filename = sanitize_filename(f"{title}.mp4")
        dest_path = videos_dir / filename

        if dest_path.exists():
            state.videos_downloaded[entry_id] = {"filename": filename}
            skipped += 1
            continue

        print(f"  Downloading: {title}")

        if download_kaltura_video(session, entry_id, ks, dest_path):
            state.videos_downloaded[entry_id] = {"filename": filename}
            new_videos += 1
        else:
            failed += 1

    # Save video list
    video_list = [{"entry_id": eid} for eid in sorted(kaltura_ids)]
    videos_json.write_text(json.dumps(video_list, indent=2))

    print(f"Videos: {new_videos} downloaded, {skipped} skipped, {failed} failed")


# ============================================================================
# Main
# ============================================================================

def show_status():
    """Show current sync status"""
    state = load_state()

    print("Canvas LMS Sync Status")
    print("="*70)
    print(f"Last sync: {state.last_sync or 'Never'}")
    print(f"Files downloaded: {len(state.files_downloaded)}")
    print(f"Videos downloaded: {len(state.videos_downloaded)}")
    print(f"Conversations synced: {len(state.conversations_synced)}")
    print(f"Pages synced: {len(state.pages_synced)}")
    print(f"Announcements synced: {len(state.announcements_synced)}")

    # Disk usage
    if OUTPUT_DIR.exists():
        import subprocess
        result = subprocess.run(["du", "-sh", str(OUTPUT_DIR)], capture_output=True, text=True)
        if result.returncode == 0:
            size = result.stdout.split()[0]
            print(f"Total disk usage: {size}")


def reset_state():
    """Reset sync state (will re-download everything)"""
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    print("Sync state reset. Next sync will re-download everything.")


def main():
    if "--status" in sys.argv:
        show_status()
        return

    if "--reset" in sys.argv:
        reset_state()
        return

    print("Canvas LMS Incremental Sync")
    print("="*70)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    state = load_state()
    all_files: dict[int, dict] = {}
    all_kaltura_ids: set[str] = set()

    # Sync courses
    for course_id in LPG001_COURSES:
        sync_course(course_id, state, all_files, all_kaltura_ids)

    # Sync conversations
    sync_conversations(state)

    # Download files
    sync_files(all_files, state)

    # Download Kaltura videos
    sync_kaltura_videos(all_kaltura_ids, state)

    # Update last sync time
    state.last_sync = datetime.now(timezone.utc).isoformat()
    save_state(state)

    print("\n" + "="*70)
    print(f"SYNC COMPLETE: {datetime.now(timezone.utc).isoformat()}")
    print("="*70)


if __name__ == "__main__":
    main()
