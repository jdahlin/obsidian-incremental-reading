#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "httpx",
#     "browser-cookie3",
#     "google-auth",
#     "google-api-python-client",
# ]
# ///
"""
Slow overnight scraper for kandidaterna.app
Downloads posts with metadata + files, organized by category.

Usage:
    uv run scraper.py                      # Default: 15-45s delay
    uv run scraper.py --delay 5            # 5s delay between requests
    uv run scraper.py --delay 1 --proxy http://proxy:8080  # Fast with proxy
    uv run scraper.py --no-files           # Skip file downloads (metadata only)
"""

import argparse
import httpx
import browser_cookie3
import json
import io
import os
import re
import sys
import time
import random
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, parse_qs

# Google API imports (optional - only used if google_token.json exists)
try:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False

# Disable output buffering (for screen/nohup)
sys.stdout.reconfigure(line_buffering=True)

# Google OAuth token file (created by google_auth.py)
GOOGLE_TOKEN_FILE = Path("google_token.json")
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
]

# Configuration
API_BASE = "https://api.kandidaterna.app/v1"
FIREBASE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token"
FIREBASE_API_KEY = "AIzaSyC0p7JM-O3FkeSwoPOMYCEJ55K08Dry4HY"
FIREBASE_GMP_ID = "1:644810584310:web:fb0c47ae4f31e6f10a7cd7"

# Auth credentials
ENV_FILE = Path(".env")


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        os.environ.setdefault(key, value)


_load_env_file(ENV_FILE)
REFRESH_TOKEN = os.environ.get("KANDIDATERNA_REFRESH_TOKEN")
SESSION_COOKIE = "s%3ASoYJjtTzwPXkP9n5Vy0d4PT1IPN2%3Aedf5184d-78b2-4761-b037-7fb73defaa9e.r4hug9XzU2aZT%2B7asQW9Q39tiKPdSLQVH5WkWlBMVUg"

# All categories from kandidaterna.app/new-library
CATEGORIES = {
    100: "Introduktion",
    101: "Anatomi och histologi 1",
    102: "Biokemi",
    103: "Anatomi och histologi 2",
    104: "Fysiologi",
    105: "Molekylär cellbiologi och utvecklingsbiologi",
    106: "Klinisk anatomi, radiologi och konsultation",
    107: "Genetik, patologi, PU, farmakologi och konsultation",
    108: "Infektion, immunologi, reumatologi mfl",
    109: "Internmedicin",
    110: "Kirurgi",
    111: "Psykiatri, neurologi, ÖNH och oftalmologi",
    112: "Gynekologi, obstetrik och pediatrik",
}

# Output directory
OUTPUT_DIR = Path("scraped_data")


class KandidaternaScraper:
    def __init__(self, delay: float = 15, delay_variance: float = 30, file_delay: float = 30,
                 proxy: str | None = None, download_files: bool = True):
        self.access_token = None
        self.token_expires_at = 0
        self.base_delay = delay
        self.delay = delay  # Current delay (adjusted dynamically)
        self.delay_variance = delay_variance
        self.base_file_delay = file_delay
        self.file_delay = file_delay  # Current file delay (adjusted dynamically)
        self.download_files = download_files
        self.consecutive_errors = 0
        self.consecutive_successes = 0

        client_kwargs = {"timeout": 60.0, "follow_redirects": True}
        if proxy:
            client_kwargs["proxy"] = proxy
        self.client = httpx.Client(**client_kwargs)

        # Initialize Google API services if credentials available
        self.google_drive_service = None
        self.google_creds = None
        self._init_google_api()

    def _init_google_api(self):
        """Initialize Google API services if credentials are available."""
        if not GOOGLE_API_AVAILABLE:
            return

        if not GOOGLE_TOKEN_FILE.exists():
            return

        try:
            token_data = json.loads(GOOGLE_TOKEN_FILE.read_text())

            # Check if we have a refresh token or just an access token
            if token_data.get("refresh_token"):
                self.google_creds = Credentials.from_authorized_user_file(
                    str(GOOGLE_TOKEN_FILE), GOOGLE_SCOPES
                )
                # Refresh if expired
                if self.google_creds and self.google_creds.expired:
                    self.google_creds.refresh(Request())
                    GOOGLE_TOKEN_FILE.write_text(self.google_creds.to_json())
            else:
                # Just an access token (from browser) - create credentials directly
                self.google_creds = Credentials(
                    token=token_data.get("token"),
                    token_uri="https://oauth2.googleapis.com/token",
                    scopes=GOOGLE_SCOPES,
                )
                print("[init] Using browser access token (will expire in ~1hr)")

            if self.google_creds and self.google_creds.token:
                self.google_drive_service = build('drive', 'v3', credentials=self.google_creds)
                print("[init] Google API initialized successfully")
            else:
                print("[init] Google credentials invalid - run google_auth.py")
        except Exception as e:
            print(f"[init] Failed to initialize Google API: {e}")

    def _reload_google_token(self) -> bool:
        """Reload Google token from file (for hot-reload without restart)."""
        if not GOOGLE_API_AVAILABLE:
            return False

        if not GOOGLE_TOKEN_FILE.exists():
            return False

        try:
            token_data = json.loads(GOOGLE_TOKEN_FILE.read_text())
            new_token = token_data.get("token")

            if not new_token:
                return False

            # Check if token actually changed
            if self.google_creds and self.google_creds.token == new_token:
                return False

            self.log("[reload] Reloading Google token from file...")

            # Create new credentials
            self.google_creds = Credentials(
                token=new_token,
                token_uri="https://oauth2.googleapis.com/token",
                scopes=GOOGLE_SCOPES,
            )

            if self.google_creds.token:
                self.google_drive_service = build('drive', 'v3', credentials=self.google_creds)
                self.log("[reload] Google API reloaded successfully")
                return True

        except Exception as e:
            self.log(f"[reload] Failed to reload Google token: {e}")

        return False

    def log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {msg}")

    def get_google_cookies(self) -> dict:
        """Get Google cookies from Brave browser."""
        if not hasattr(self, '_google_cookies'):
            try:
                cj = browser_cookie3.brave(domain_name=".google.com")
                self._google_cookies = {c.name: c.value for c in cj}
                self.log(f"  Loaded {len(self._google_cookies)} Google cookies from Brave")
            except Exception as e:
                self.log(f"  Failed to load Google cookies: {e}")
                self._google_cookies = {}
        return self._google_cookies

    def get_microsoft_cookies(self) -> dict:
        """Get Microsoft/SharePoint cookies from Brave browser."""
        if not hasattr(self, '_microsoft_cookies'):
            try:
                cookies = {}
                for domain in [".microsoft.com", ".sharepoint.com", ".live.com"]:
                    try:
                        cj = browser_cookie3.brave(domain_name=domain)
                        cookies.update({c.name: c.value for c in cj})
                    except:
                        pass
                self._microsoft_cookies = cookies
                self.log(f"  Loaded {len(self._microsoft_cookies)} Microsoft cookies from Brave")
            except Exception as e:
                self.log(f"  Failed to load Microsoft cookies: {e}")
                self._microsoft_cookies = {}
        return self._microsoft_cookies

    def is_external_url(self, url: str) -> bool:
        """Check if URL is external (not a kandidaterna UUID)."""
        # kandidaterna files are UUIDs like "6107231c-94fc-4da0-9dbb-765000c499e3.pdf"
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$'
        return not re.match(uuid_pattern, url, re.IGNORECASE)

    def download_external_file(self, url: str, dest_path: Path) -> bool:
        """Download file from external source (Google, SharePoint, etc.)."""
        if dest_path.exists():
            self.log(f"  File already exists: {dest_path.name}")
            return True

        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Skip non-downloadable URLs
        skip_patterns = ["youtube.com", "youtu.be", "forms.gle", "forms.google.com"]
        if any(p in domain for p in skip_patterns):
            self.log(f"  Skipping non-downloadable: {domain}")
            return False

        try:
            if "docs.google.com/document" in url:
                return self._download_google_doc(url, dest_path)
            elif "docs.google.com/spreadsheets" in url:
                return self._download_google_sheet(url, dest_path)
            elif "drive.google.com" in domain:
                return self._download_google_drive(url, dest_path)
            elif "sharepoint.com" in domain or "gunet-my.sharepoint.com" in domain:
                return self._download_sharepoint(url, dest_path)
            else:
                self.log(f"  Unknown external source: {domain}")
                return False
        except Exception as e:
            self.log(f"  External download error: {e}")
            return False

    def _download_google_doc(self, url: str, dest_path: Path) -> bool:
        """Download Google Doc as PDF."""
        # Extract doc ID from URL
        # https://docs.google.com/document/d/{ID}/edit
        match = re.search(r'/document/d/([a-zA-Z0-9_-]+)', url)
        if not match:
            self.log(f"  Could not extract Google Doc ID from: {url}")
            return False

        doc_id = match.group(1)

        # Try API first if available
        if self.google_drive_service:
            return self._export_google_doc_api(
                doc_id, 'application/vnd.google-apps.document', dest_path
            )

        # Fallback to export URL
        export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=pdf"

        cookies = self.get_google_cookies()
        resp = self.client.get(
            export_url,
            cookies=cookies,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        )

        if resp.status_code == 200 and len(resp.content) > 1000:
            # Check if we got HTML (login page) instead of PDF
            if resp.content[:20].startswith(b'<!doctype') or resp.content[:20].startswith(b'<html'):
                self.log(f"  Google Doc requires auth (no API credentials)")
                return False
            # Change extension to .pdf
            pdf_path = dest_path.with_suffix('.pdf')
            pdf_path.write_bytes(resp.content)
            self.log(f"  Downloaded Google Doc: {pdf_path.name} ({len(resp.content)} bytes)")
            return True
        else:
            self.log(f"  Failed to download Google Doc: {resp.status_code}")
            return False

    def _download_google_sheet(self, url: str, dest_path: Path) -> bool:
        """Download Google Sheet as xlsx."""
        # Extract sheet ID from URL
        # https://docs.google.com/spreadsheets/d/{ID}/edit
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9_-]+)', url)
        if not match:
            self.log(f"  Could not extract Google Sheet ID from: {url}")
            return False

        sheet_id = match.group(1)

        # Try API first if available
        if self.google_drive_service:
            return self._export_google_doc_api(
                sheet_id, 'application/vnd.google-apps.spreadsheet', dest_path
            )

        # Fallback to export URL
        export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"

        cookies = self.get_google_cookies()
        resp = self.client.get(
            export_url,
            cookies=cookies,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        )

        if resp.status_code == 200 and len(resp.content) > 1000:
            # Check if we got HTML (login page) instead of xlsx
            if resp.content[:20].startswith(b'<!doctype') or resp.content[:20].startswith(b'<html'):
                self.log(f"  Google Sheet requires auth (no API credentials)")
                return False
            xlsx_path = dest_path.with_suffix('.xlsx')
            xlsx_path.write_bytes(resp.content)
            self.log(f"  Downloaded Google Sheet: {xlsx_path.name} ({len(resp.content)} bytes)")
            return True
        else:
            self.log(f"  Failed to download Google Sheet: {resp.status_code}")
            return False

    def _download_google_drive(self, url: str, dest_path: Path) -> bool:
        """Download file from Google Drive."""
        # Check if it's a folder
        if "/folders/" in url:
            return self._download_google_drive_folder(url, dest_path)

        # Extract file ID
        # https://drive.google.com/file/d/{ID}/view
        match = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if not match:
            # Try open?id= format
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            if 'id' in params:
                file_id = params['id'][0]
            else:
                self.log(f"  Could not extract Google Drive file ID from: {url}")
                return False
        else:
            file_id = match.group(1)

        # Try Google API first if available
        if self.google_drive_service:
            return self._download_drive_file_api(file_id, dest_path)

        # Fallback to direct download URL
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"

        cookies = self.get_google_cookies()
        resp = self.client.get(
            download_url,
            cookies=cookies,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        )

        if resp.status_code == 200 and len(resp.content) > 1000:
            # Check if we got HTML (login/confirmation page) instead of file
            if resp.content[:20].startswith(b'<!doctype') or resp.content[:20].startswith(b'<html'):
                self.log(f"  Google Drive file requires auth (no API credentials)")
                return False
            dest_path.write_bytes(resp.content)
            self.log(f"  Downloaded Google Drive file: {dest_path.name} ({len(resp.content)} bytes)")
            return True
        else:
            self.log(f"  Failed to download Google Drive file: {resp.status_code}")
            return False

    def _download_drive_file_api(self, file_id: str, dest_path: Path, retry: bool = True) -> bool:
        """Download a file from Google Drive using the API."""
        try:
            # Get file metadata first
            file_meta = self.google_drive_service.files().get(
                fileId=file_id, fields='name,mimeType,size'
            ).execute()

            mime_type = file_meta.get('mimeType', '')
            file_name = file_meta.get('name', 'file')

            # Handle Google Docs/Sheets/etc (need to export)
            if mime_type.startswith('application/vnd.google-apps'):
                return self._export_google_doc_api(file_id, mime_type, dest_path)

            # Regular file - download directly
            request = self.google_drive_service.files().get_media(fileId=file_id)
            content = io.BytesIO()
            downloader = MediaIoBaseDownload(content, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()

            content.seek(0)
            # Use original extension if dest_path doesn't have one
            if not dest_path.suffix:
                ext = Path(file_name).suffix
                dest_path = dest_path.with_suffix(ext)

            dest_path.write_bytes(content.read())
            self.log(f"  Downloaded via API: {dest_path.name} ({file_meta.get('size', '?')} bytes)")
            return True

        except Exception as e:
            err_str = str(e).lower()
            # Check for auth errors - try reloading token
            if retry and ('401' in err_str or '403' in err_str or 'invalid' in err_str or 'expired' in err_str):
                self.log(f"  Google auth error - trying to reload token...")
                if self._reload_google_token():
                    return self._download_drive_file_api(file_id, dest_path, retry=False)
            self.log(f"  Google API download failed: {e}")
            return False

    def _export_google_doc_api(self, file_id: str, mime_type: str, dest_path: Path, retry: bool = True) -> bool:
        """Export a Google Doc/Sheet/Slide using API."""
        try:
            # Determine export format
            export_formats = {
                'application/vnd.google-apps.document': ('application/pdf', '.pdf'),
                'application/vnd.google-apps.spreadsheet': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'),
                'application/vnd.google-apps.presentation': ('application/pdf', '.pdf'),
            }

            if mime_type not in export_formats:
                self.log(f"  Unsupported Google doc type: {mime_type}")
                return False

            export_mime, ext = export_formats[mime_type]
            request = self.google_drive_service.files().export_media(
                fileId=file_id, mimeType=export_mime
            )

            content = io.BytesIO()
            downloader = MediaIoBaseDownload(content, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()

            content.seek(0)
            final_path = dest_path.with_suffix(ext)
            final_path.write_bytes(content.read())
            self.log(f"  Exported via API: {final_path.name}")
            return True

        except Exception as e:
            err_str = str(e).lower()
            # Check for auth errors - try reloading token
            if retry and ('401' in err_str or '403' in err_str or 'invalid' in err_str or 'expired' in err_str):
                self.log(f"  Google auth error - trying to reload token...")
                if self._reload_google_token():
                    return self._export_google_doc_api(file_id, mime_type, dest_path, retry=False)
            self.log(f"  Google API export failed: {e}")
            return False

    def _download_google_drive_folder(self, url: str, dest_dir: Path) -> bool:
        """Download all files from a Google Drive folder."""
        if not self.google_drive_service:
            self.log(f"  Skipping Drive folder (no API credentials) - run google_auth.py")
            return False

        # Extract folder ID
        match = re.search(r'/folders/([a-zA-Z0-9_-]+)', url)
        if not match:
            self.log(f"  Could not extract folder ID from: {url}")
            return False

        folder_id = match.group(1)

        try:
            # List files in folder
            results = self.google_drive_service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="files(id,name,mimeType,size)",
                pageSize=100
            ).execute()

            files = results.get('files', [])
            if not files:
                self.log(f"  Drive folder is empty or inaccessible")
                return False

            self.log(f"  Found {len(files)} files in Drive folder")

            # Create subfolder for this folder's contents
            dest_dir.mkdir(parents=True, exist_ok=True)
            success_count = 0

            for file_info in files:
                file_id = file_info['id']
                file_name = file_info['name']
                safe_name = file_name.replace("/", "_").replace("\\", "_")
                file_path = dest_dir / safe_name

                if file_path.exists():
                    self.log(f"    Already exists: {safe_name}")
                    success_count += 1
                    continue

                mime_type = file_info.get('mimeType', '')
                if mime_type == 'application/vnd.google-apps.folder':
                    self.log(f"    Skipping subfolder: {safe_name}")
                    continue

                if mime_type.startswith('application/vnd.google-apps'):
                    if self._export_google_doc_api(file_id, mime_type, file_path):
                        success_count += 1
                else:
                    if self._download_drive_file_api(file_id, file_path):
                        success_count += 1

                self.random_delay(for_file=True)

            self.log(f"  Downloaded {success_count}/{len(files)} files from folder")
            return success_count > 0

        except Exception as e:
            self.log(f"  Failed to list Drive folder: {e}")
            return False

    def _download_sharepoint(self, url: str, dest_path: Path) -> bool:
        """Download file from SharePoint/OneDrive."""
        cookies = self.get_microsoft_cookies()

        if not cookies:
            self.log(f"  No Microsoft cookies - can't download SharePoint")
            return False

        # Try to access the URL directly
        resp = self.client.get(
            url,
            cookies=cookies,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        )

        # SharePoint often requires additional steps - this is a basic attempt
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type and len(resp.content) > 1000:
                dest_path.write_bytes(resp.content)
                self.log(f"  Downloaded SharePoint file: {dest_path.name} ({len(resp.content)} bytes)")
                return True

        self.log(f"  SharePoint download not supported for this URL type")
        return False

    def on_success(self):
        """Called after a successful request - gradually reduce delays."""
        self.consecutive_errors = 0
        self.consecutive_successes += 1

        # After 10 consecutive successes, try reducing delay (min: base delay)
        if self.consecutive_successes >= 10:
            old_delay = self.delay
            self.delay = max(self.base_delay, self.delay * 0.9)
            self.file_delay = max(self.base_file_delay, self.file_delay * 0.9)
            if self.delay < old_delay:
                self.log(f"  [backoff] Reducing delays: API={self.delay:.1f}s, file={self.file_delay:.1f}s")
            self.consecutive_successes = 0

    def on_error(self, status_code: int) -> float:
        """Called after an error - increase delays exponentially. Returns wait time."""
        self.consecutive_successes = 0
        self.consecutive_errors += 1

        # Exponential backoff: 1min, 2min, 4min, 8min, max 15min
        base_wait = 60
        wait_time = min(base_wait * (2 ** (self.consecutive_errors - 1)), 900)

        # Increase future delays
        if status_code == 503 or status_code == 429:
            # Rate limited - increase delays more aggressively
            self.delay = min(self.delay * 2, 120)  # Max 2 minutes between API calls
            self.file_delay = min(self.file_delay * 2, 120)
            self.log(f"  [backoff] Rate limited ({status_code})! New delays: API={self.delay:.1f}s, file={self.file_delay:.1f}s")
        elif status_code >= 500:
            # Server error - moderate increase
            self.delay = min(self.delay * 1.5, 90)
            self.file_delay = min(self.file_delay * 1.5, 90)
            self.log(f"  [backoff] Server error ({status_code}). New delays: API={self.delay:.1f}s, file={self.file_delay:.1f}s")

        return wait_time

    def refresh_access_token(self):
        """Get a new access token using the refresh token."""
        if not REFRESH_TOKEN:
            raise RuntimeError("Missing KANDIDATERNA_REFRESH_TOKEN (set it in .env or environment).")

        self.log("Refreshing access token...")

        resp = self.client.post(
            f"{FIREBASE_TOKEN_URL}?key={FIREBASE_API_KEY}",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://kandidaterna.app",
                "Referer": "https://kandidaterna.app/",
                "X-Client-Version": "Chrome/JsCore/12.6.0/FirebaseCore-web",
                "X-Firebase-Gmpid": FIREBASE_GMP_ID,
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": REFRESH_TOKEN,
            },
        )

        if resp.status_code != 200:
            self.log(f"Token refresh failed: {resp.status_code}")
            self.log(resp.text)
            raise Exception("Failed to refresh token")

        data = resp.json()
        self.access_token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        self.token_expires_at = time.time() + expires_in - 300  # 5 min buffer
        self.log(f"Token refreshed, expires in {expires_in}s")

    def ensure_valid_token(self):
        """Refresh token if expired or missing."""
        if not self.access_token or time.time() >= self.token_expires_at:
            self.refresh_access_token()

    def get_headers(self):
        return {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
            "Authorization": self.access_token,
            "Origin": "https://kandidaterna.app",
            "Referer": "https://kandidaterna.app/",
            "kandidaterna-web-app-version": "9.19.2",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }

    def get_cookies(self):
        return {"kandidaterna-client-session-id": SESSION_COOKIE}

    def fetch_posts(self, category_id: int, start_after: int | None = None) -> dict:
        """Fetch a page of posts with retry logic."""
        max_retries = 5

        for attempt in range(max_retries):
            self.ensure_valid_token()

            params = {
                "destination": "new_library",
                "category": str(category_id),
            }
            if start_after:
                params["startAfter"] = str(start_after)

            try:
                resp = self.client.get(
                    f"{API_BASE}/posts",
                    params=params,
                    headers=self.get_headers(),
                    cookies=self.get_cookies(),
                )

                if resp.status_code == 200:
                    self.on_success()
                    return resp.json()

                # Handle errors with backoff
                wait_time = self.on_error(resp.status_code)
                self.log(f"API error: {resp.status_code} (attempt {attempt + 1}/{max_retries})")

                if resp.status_code == 401:
                    # Auth error - force token refresh
                    self.access_token = None
                    self.log("  Auth error, refreshing token...")
                    time.sleep(5)
                elif resp.status_code in (429, 503):
                    # Rate limit - wait longer
                    self.log(f"  Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                elif resp.status_code >= 500:
                    # Server error - wait and retry
                    self.log(f"  Server error, waiting {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    # Client error - don't retry
                    self.log(resp.text[:500])
                    raise Exception(f"API returned {resp.status_code}")

            except httpx.TimeoutException:
                wait_time = self.on_error(0)
                self.log(f"Timeout (attempt {attempt + 1}/{max_retries}), waiting {wait_time}s...")
                time.sleep(wait_time)
            except httpx.RequestError as e:
                wait_time = self.on_error(0)
                self.log(f"Request error: {e} (attempt {attempt + 1}/{max_retries}), waiting {wait_time}s...")
                time.sleep(wait_time)

        raise Exception(f"Failed after {max_retries} attempts")

    def download_file(self, post_id: str, attachment_url: str, dest_path: Path) -> bool:
        """Download a file via the API endpoint with retry logic."""
        if dest_path.exists():
            self.log(f"  File already exists: {dest_path.name}")
            return True

        max_retries = 3
        full_url = f"{API_BASE}/posts/{post_id}/attachments/{attachment_url}"

        for attempt in range(max_retries):
            self.ensure_valid_token()

            try:
                resp = self.client.get(
                    full_url,
                    headers=self.get_headers(),
                    cookies=self.get_cookies(),
                )

                if resp.status_code == 200:
                    dest_path.write_bytes(resp.content)
                    self.log(f"  Downloaded: {dest_path.name} ({len(resp.content)} bytes)")
                    self.on_success()
                    return True

                # Handle errors with backoff
                wait_time = self.on_error(resp.status_code)

                if resp.status_code in (429, 503):
                    self.log(f"  Rate limited downloading {dest_path.name}, waiting {wait_time}s...")
                    time.sleep(wait_time)
                elif resp.status_code >= 500:
                    self.log(f"  Server error ({resp.status_code}) downloading {dest_path.name}, waiting {wait_time}s...")
                    time.sleep(wait_time)
                elif resp.status_code == 401:
                    self.access_token = None
                    self.log(f"  Auth error downloading {dest_path.name}, refreshing token...")
                    time.sleep(5)
                else:
                    self.log(f"  Failed to download {attachment_url}: {resp.status_code}")
                    return False

            except httpx.TimeoutException:
                wait_time = self.on_error(0)
                self.log(f"  Timeout downloading {dest_path.name} (attempt {attempt + 1}), waiting {wait_time}s...")
                time.sleep(wait_time)
            except httpx.RequestError as e:
                wait_time = self.on_error(0)
                self.log(f"  Download error: {e} (attempt {attempt + 1}), waiting {wait_time}s...")
                time.sleep(wait_time)

        self.log(f"  Failed to download {dest_path.name} after {max_retries} attempts")
        return False

    def random_delay(self, for_file: bool = False):
        """Sleep for a random duration."""
        if for_file:
            delay = self.file_delay + random.uniform(0, 2)
        else:
            delay = self.delay + random.uniform(0, self.delay_variance)
        self.log(f"Sleeping {delay:.1f}s...")
        time.sleep(delay)

    def scrape_category(self, category_id: int, category_name: str):
        """Scrape all posts in a category."""
        category_dir = OUTPUT_DIR / category_name.lower().replace(" ", "_")
        files_dir = category_dir / "files"
        category_dir.mkdir(parents=True, exist_ok=True)
        files_dir.mkdir(exist_ok=True)

        all_posts = []
        cursor = None
        page = 0
        existing_post_ids = set()

        # Load existing final data if available (completed scrape)
        final_file = category_dir / f"{category_name.lower().replace(' ', '_')}_all.json"
        progress_file = category_dir / "progress.json"

        if final_file.exists():
            data = json.loads(final_file.read_text())
            all_posts = data.get("posts", [])
            existing_post_ids = {p["id"] for p in all_posts}
            self.log(f"Found {len(all_posts)} existing posts, checking for new ones and missing files...")
        elif progress_file.exists():
            progress = json.loads(progress_file.read_text())
            cursor = progress.get("cursor")
            all_posts = progress.get("posts", [])
            existing_post_ids = {p["id"] for p in all_posts}
            page = progress.get("page", 0)
            self.log(f"Resuming from page {page}, {len(all_posts)} posts already saved")

        self.log(f"Starting scrape of {category_name} (category {category_id})")

        while True:
            page += 1
            self.log(f"Fetching page {page}...")

            try:
                data = self.fetch_posts(category_id, start_after=cursor)
            except Exception as e:
                # fetch_posts already retried multiple times, this is a hard failure
                self.log(f"Fatal error after retries: {e}")
                self.log("Saving progress...")
                self.save_progress(category_dir, all_posts, cursor, page - 1)
                raise  # Re-raise to stop this category

            posts = data.get("posts", [])
            if not posts:
                self.log("No more posts - done!")
                break

            # Process each post
            for post in posts:
                post_id = post.get("id")

                # Check if post already exists
                if post_id in existing_post_ids:
                    # Find existing post and download any missing files
                    existing_post = next((p for p in all_posts if p["id"] == post_id), None)
                    if existing_post and self.download_files:
                        for att in existing_post.get("attachments", []):
                            if att.get("downloaded"):
                                continue
                            local_file = att.get("local_file")
                            if not local_file:
                                continue
                            dest_path = files_dir / local_file
                            if dest_path.exists() and dest_path.stat().st_size > 0:
                                att["downloaded"] = True
                                continue
                            url = att.get("url")
                            if not url:
                                continue
                            self.log(f"  Downloading missing: {local_file}")
                            is_external = att.get("is_external", self.is_external_url(url))
                            if is_external:
                                if self.download_external_file(url, dest_path):
                                    att["downloaded"] = True
                                    self.random_delay(for_file=True)
                            else:
                                if self.download_file(post_id, url, dest_path):
                                    att["downloaded"] = True
                                    self.random_delay(for_file=True)
                    continue  # Skip adding duplicate post

                # New post - extract what we need
                post_data = {
                    "id": post_id,
                    "title": post.get("title", ""),
                    "description": post.get("description", ""),
                    "author": post.get("author", ""),
                    "type": post.get("type", ""),
                    "created": post.get("created"),
                    "visibility": post.get("visibility", ""),
                    "attachments": [],
                }

                # Process attachments
                for att in post.get("attachments", []):
                    att_data = {
                        "name": att.get("name", ""),
                        "type": att.get("type", ""),
                        "url": att.get("url", ""),
                        "downloaded": False,
                    }

                    if att.get("url"):
                        url = att["url"]
                        is_external = self.is_external_url(url)

                        # Create safe filename
                        if is_external:
                            # For external URLs, use attachment name
                            base_name = att.get('name', 'file').replace("/", "_").replace(" ", "_")
                            safe_name = f"{post_id}_{base_name}"
                        else:
                            # For kandidaterna files, use UUID filename
                            ext = Path(url).suffix or ".bin"
                            safe_name = f"{post_id}_{att.get('name', 'file')}{ext}".replace("/", "_").replace(" ", "_")

                        att_data["local_file"] = safe_name
                        att_data["is_external"] = is_external

                        # Download file if enabled
                        if self.download_files:
                            dest_path = files_dir / safe_name
                            # Skip if already downloaded
                            if dest_path.exists() and dest_path.stat().st_size > 0:
                                self.log(f"  Skipping (exists): {safe_name}")
                                att_data["downloaded"] = True
                            elif is_external:
                                if self.download_external_file(url, dest_path):
                                    att_data["downloaded"] = True
                                    self.random_delay(for_file=True)
                            else:
                                if self.download_file(post_id, url, dest_path):
                                    att_data["downloaded"] = True
                                    self.random_delay(for_file=True)

                    post_data["attachments"].append(att_data)

                all_posts.append(post_data)
                existing_post_ids.add(post_id)

                # Save progress after each post (in case of crash during downloads)
                post_cursor = post.get("created")
                if post_cursor:
                    self.save_progress(category_dir, all_posts, post_cursor, page)

            self.log(f"Got {len(posts)} posts, total: {len(all_posts)}")

            # Get cursor for next page
            last_post = posts[-1]
            cursor = last_post.get("created")

            if not cursor:
                self.log("No cursor found in last post")
                self.log(f"Last post keys: {list(last_post.keys())}")
                break

            # Be nice - random delay
            self.random_delay()

        # Final save
        self.save_final(category_dir, category_id, category_name, all_posts)
        return all_posts

    def save_progress(self, category_dir: Path, posts: list, cursor: int | None, page: int):
        """Save progress for resume capability."""
        progress = {
            "cursor": cursor,
            "page": page,
            "posts": posts,
            "updated_at": datetime.now().isoformat(),
        }
        (category_dir / "progress.json").write_text(json.dumps(progress, indent=2, ensure_ascii=False))

    def save_final(self, category_dir: Path, category_id: int, category_name: str, posts: list):
        """Save final results."""
        output = {
            "category_id": category_id,
            "category_name": category_name,
            "total_posts": len(posts),
            "scraped_at": datetime.now().isoformat(),
            "posts": posts,
        }
        output_file = category_dir / f"{category_name.lower()}_all.json"
        output_file.write_text(json.dumps(output, indent=2, ensure_ascii=False))
        self.log(f"Saved {len(posts)} posts to {output_file}")

    def close(self):
        self.client.close()


def download_missing_files(scraper, cat_id: int, cat_name: str):
    """Download missing files for an already-scraped category."""
    print(f"\nDownloading files for: {cat_name} (ID: {cat_id})")
    print("-" * 40)

    category_dir = OUTPUT_DIR / cat_name.lower().replace(" ", "_")
    json_file = category_dir / f"{cat_name.lower().replace(' ', '_')}_all.json"
    files_dir = category_dir / "files"
    files_dir.mkdir(exist_ok=True)

    if not json_file.exists():
        print(f"No data file found: {json_file}")
        return

    data = json.loads(json_file.read_text())
    posts = data.get("posts", [])
    print(f"Found {len(posts)} posts")

    total_files = 0
    downloaded = 0
    skipped = 0
    failed = 0

    for post in posts:
        post_id = post.get("id")
        for att in post.get("attachments", []):
            url = att.get("url")
            if not url:
                continue

            total_files += 1
            is_external = scraper.is_external_url(url)

            # Build filename
            if is_external:
                base_name = att.get('name', 'file').replace("/", "_").replace(" ", "_")
                safe_name = f"{post_id}_{base_name}"
            else:
                ext = Path(url).suffix or ".bin"
                safe_name = f"{post_id}_{att.get('name', 'file')}{ext}".replace("/", "_").replace(" ", "_")

            dest_path = files_dir / safe_name

            # Skip if exists
            if dest_path.exists() and dest_path.stat().st_size > 0:
                skipped += 1
                continue

            # Download
            scraper.log(f"Downloading: {safe_name}")
            success = False
            if is_external:
                success = scraper.download_external_file(url, dest_path)
            else:
                success = scraper.download_file(post_id, url, dest_path)

            if success:
                downloaded += 1
                att["downloaded"] = True
                scraper.random_delay(for_file=True)
            else:
                failed += 1

    # Update the JSON with download status
    json_file.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(f"\nResults:")
    print(f"  Total files: {total_files}")
    print(f"  Already existed: {skipped}")
    print(f"  Downloaded: {downloaded}")
    print(f"  Failed: {failed}")


def check_category(scraper, cat_id: int, cat_name: str):
    """Check a category - compare local data to API."""
    print(f"\nChecking: {cat_name} (ID: {cat_id})")
    print("-" * 40)

    # Load local data
    category_dir = OUTPUT_DIR / cat_name.lower().replace(" ", "_")
    json_file = category_dir / f"{cat_name.lower().replace(' ', '_')}_all.json"

    local_posts = []
    if json_file.exists():
        data = json.loads(json_file.read_text())
        local_posts = data.get("posts", [])
        print(f"Local: {len(local_posts)} posts saved")
    else:
        print("Local: No data file found")

    # Count from API (just first page to check)
    print("Fetching from API...")
    try:
        first_page = scraper.fetch_posts(cat_id)
        api_posts = first_page.get("posts", [])
        print(f"API first page: {len(api_posts)} posts")

        if api_posts:
            # Count total by paginating quickly
            total_count = len(api_posts)
            cursor = api_posts[-1].get("created") if api_posts else None

            while cursor:
                time.sleep(2)  # Quick delay for counting
                page = scraper.fetch_posts(cat_id, start_after=cursor)
                posts = page.get("posts", [])
                if not posts:
                    break
                total_count += len(posts)
                cursor = posts[-1].get("created") if posts else None
                print(f"  Counting... {total_count} posts so far")

            print(f"API total: {total_count} posts")

            if local_posts:
                if len(local_posts) == total_count:
                    print("STATUS: Complete!")
                elif len(local_posts) < total_count:
                    print(f"STATUS: Missing {total_count - len(local_posts)} posts")
                else:
                    print(f"STATUS: Local has {len(local_posts) - total_count} extra posts (duplicates?)")
        else:
            print("API returned no posts")

    except Exception as e:
        print(f"API error: {e}")

    # Check file downloads
    files_dir = category_dir / "files"
    if files_dir.exists():
        downloaded_files = list(files_dir.glob("*"))
        print(f"Files downloaded: {len(downloaded_files)}")

        # Count expected files
        expected_files = sum(len(p.get("attachments", [])) for p in local_posts)
        downloaded_count = sum(
            1 for p in local_posts
            for a in p.get("attachments", [])
            if a.get("downloaded", False)
        )
        print(f"Attachments: {downloaded_count}/{expected_files} marked as downloaded")
    else:
        print("Files: No files directory")


def main():
    parser = argparse.ArgumentParser(description="Scrape kandidaterna.app")
    parser.add_argument("--delay", type=float, default=15,
                        help="Base delay between API requests in seconds (default: 15)")
    parser.add_argument("--delay-variance", type=float, default=30,
                        help="Random variance added to delay (default: 30, so 15-45s)")
    parser.add_argument("--file-delay", type=float, default=30,
                        help="Delay between file downloads in seconds (default: 30)")
    parser.add_argument("--proxy", type=str, default=None,
                        help="HTTP proxy URL (e.g., http://proxy:8080)")
    parser.add_argument("--no-files", action="store_true",
                        help="Skip downloading files, only get metadata")
    parser.add_argument("--category", type=int, default=None,
                        help="Only scrape a specific category ID (e.g., 104 for Fysiologi)")
    parser.add_argument("--check", action="store_true",
                        help="Check/verify category status instead of scraping")
    args = parser.parse_args()

    print("=" * 60)
    print("Kandidaterna.app Scraper")
    print("=" * 60)
    print(f"Output dir: {OUTPUT_DIR}")
    print(f"Categories: {CATEGORIES}")
    print(f"Delay between API calls: {args.delay}-{args.delay + args.delay_variance}s")
    print(f"Delay between file downloads: {args.file_delay}s")
    print(f"Download files: {not args.no_files}")
    if args.proxy:
        print(f"Proxy: {args.proxy}")
    print()

    # Filter categories if specific one requested
    categories_to_scrape = CATEGORIES
    if args.category:
        if args.category not in CATEGORIES:
            print(f"Unknown category {args.category}. Available: {list(CATEGORIES.keys())}")
            return
        categories_to_scrape = {args.category: CATEGORIES[args.category]}

    scraper = KandidaternaScraper(
        delay=args.delay,
        delay_variance=args.delay_variance,
        file_delay=args.file_delay,
        proxy=args.proxy,
        download_files=not args.no_files,
    )
    try:
        if args.check:
            # Check mode - verify categories
            print("\n*** CHECK MODE ***")
            for cat_id, cat_name in categories_to_scrape.items():
                check_category(scraper, cat_id, cat_name)
        else:
            # Normal scrape mode
            for cat_id, cat_name in categories_to_scrape.items():
                print(f"\n{'='*60}")
                print(f"Scraping: {cat_name} (ID: {cat_id})")
                print(f"Current delays: API={scraper.delay:.1f}s, file={scraper.file_delay:.1f}s")
                print("=" * 60)
                try:
                    posts = scraper.scrape_category(cat_id, cat_name)
                    print(f"\nFinished {cat_name}: {len(posts)} posts")
                except Exception as e:
                    print(f"\nFailed {cat_name}: {e}")
                    print("Continuing to next category...")
                    continue
    except KeyboardInterrupt:
        print("\nInterrupted by user. Progress saved.")
    finally:
        scraper.close()


if __name__ == "__main__":
    main()
