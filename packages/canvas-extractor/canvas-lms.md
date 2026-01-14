# Canvas LMS Content Sync

This directory contains downloaded content from Canvas LMS courses (LPG001) at Gothenburg University.

## Quick Start

```bash
# Run incremental sync (downloads only new content)
uv run canvas_sync.py

# Check sync status
uv run canvas_sync.py --status

# Reset state and re-download everything
uv run canvas_sync.py --reset
```

## What Gets Downloaded

| Content Type | Location | Count |
|--------------|----------|-------|
| Course pages (HTML) | `canvas-lms/{course}/modules/` | 175 pages |
| Announcements | `canvas-lms/{course}/announcements/` | 10 |
| Files (PDFs, videos, docs) | `canvas-lms/_files/` | 213 files (990 MB) |
| Kaltura videos (play.gu.se) | `canvas-lms/_videos/` | 27 videos (1 GB) |
| Conversations (inbox) | `canvas-lms/_conversations/` | synced when available |

## Directory Structure

```
canvas-lms/
├── _sync_state.json              # Sync state for incremental updates
├── _files/                       # All downloaded files
│   ├── *.pdf
│   ├── *.mp4
│   └── ...
├── _videos/                      # Kaltura videos from play.gu.se
│   ├── *.mp4
│   └── play_gu_videos.json       # Video metadata
├── _conversations/               # Inbox messages
│   ├── {date}_{subject}.html
│   └── {id}.json
├── LPG001 - Förkunskaper.../     # Course 1
│   ├── _course_info.json
│   ├── modules/
│   │   ├── 01_{module_name}/
│   │   │   ├── _module_info.json
│   │   │   ├── {page}.html
│   │   │   └── {item}.json
│   │   └── ...
│   └── announcements/
│       └── {date}_{title}.html
└── LPG001 NML 100 DAG.../        # Course 2
    └── ...
```

## Scripts

### canvas_sync.py (Main Script)

Incremental sync script that downloads all Canvas content.

**Features:**
- Tracks sync state to only download new/changed content
- Downloads course pages, modules, announcements
- Downloads files linked in HTML content
- Downloads Kaltura videos from play.gu.se
- Syncs inbox conversations

**Dependencies:** `requests`, `beautifulsoup4`, `browser_cookie3`

### canvas_list_files.py (Legacy)

Original script that lists and downloads Canvas files. Superseded by `canvas_sync.py`.

### download_kaltura.py

Finds Kaltura video entry IDs embedded in HTML files.

### download_kaltura_hls.py

Downloads videos from play.gu.se using the Kaltura API.

**How it works:**
1. Gets KS (Kaltura Session) token from embed page
2. Constructs direct download URL via api.kaltura.nordu.net
3. Downloads MP4 directly

## Configuration

### Canvas API Token

The scripts use a Canvas API token stored in the script:
```python
CANVAS_TOKEN = "12237~..."
```

To generate a new token:
1. Go to Canvas → Account → Settings
2. Scroll to "Approved Integrations"
3. Click "+ New Access Token"

### Course IDs

Currently syncing LPG001 courses:
```python
LPG001_COURSES = [86180, 91586]
```

To find course IDs, look at the URL when viewing a course: `canvas.gu.se/courses/{id}`

### Kaltura Authentication

Kaltura videos require cookies from Brave browser for authentication:
```python
cj = browser_cookie3.brave(domain_name='.gu.se')
```

Must be logged into play.gu.se in Brave for video downloads to work.

## Hourly Sync Setup

### Using cron

```bash
crontab -e
# Add:
0 * * * * cd /Users/johandahlin/PycharmProjects/kandidaterna && /Users/johandahlin/.local/bin/uv run canvas_sync.py >> /tmp/canvas_sync.log 2>&1
```

### Using launchd (macOS)

```bash
cat > ~/Library/LaunchAgents/com.canvas.sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.canvas.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/johandahlin/.local/bin/uv</string>
        <string>run</string>
        <string>canvas_sync.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/johandahlin/PycharmProjects/kandidaterna</string>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>StandardOutPath</key>
    <string>/tmp/canvas_sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/canvas_sync.log</string>
</dict>
</plist>
EOF

# Load the agent
launchctl load ~/Library/LaunchAgents/com.canvas.sync.plist

# Check status
launchctl list | grep canvas

# Unload if needed
launchctl unload ~/Library/LaunchAgents/com.canvas.sync.plist
```

## Technical Details

### Canvas API

Base URL: `https://canvas.gu.se/api/v1`

Endpoints used:
- `/courses/{id}` - Course info
- `/courses/{id}/modules` - Module list
- `/courses/{id}/modules/{id}/items` - Module items
- `/courses/{id}/pages/{url}` - Page content
- `/courses/{id}/discussion_topics?only_announcements=true` - Announcements
- `/conversations` - Inbox messages
- `/files/{id}` - File metadata and download URL

### Kaltura API

Videos are hosted on NORDUnet's Kaltura instance.

**Embed page:** `https://play.gu.se/embed/secure/iframe/entryId/{entry_id}/uiConfId/23450401`

**Direct download URL:**
```
https://api.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/url/protocol/https/ks/{ks_token}
```

The KS token is extracted from the embed page's flashvars.

### File Detection

Files are detected from HTML content by:
1. Links with `/files/{id}` in href
2. Links with `data-api-endpoint` containing file ID
3. Kaltura embeds with `play.gu.se/media/.../entry_id` or `entryId/` parameter

## Known Limitations

1. **JoVE Videos** - 88 videos on app.jove.com are identified but not downloaded (external platform, requires institutional access)

2. **Conversations** - Requires messages to exist in inbox; currently shows 0 if no messages

3. **Browser Cookies** - Kaltura downloads require being logged into play.gu.se in Brave browser

4. **Failed Files** - Some files (4) fail to download, possibly due to permissions or deleted content

## Sync State

State is stored in `canvas-lms/_sync_state.json`:

```json
{
  "last_sync": "2026-01-13T09:33:27.951511+00:00",
  "files_downloaded": {"file_id": {"filename": "...", "size": 123}},
  "videos_downloaded": {"entry_id": {"filename": "..."}},
  "conversations_synced": {"conv_id": "last_message_at"},
  "announcements_synced": {"course:ann_id": "posted_at"},
  "pages_synced": {"course:page_url": "updated_at"}
}
```

To force re-download of specific content, remove its entry from the state file or use `--reset` to clear everything.
