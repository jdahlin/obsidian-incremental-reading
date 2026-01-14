# Lecture Navigator Hub - LMS Documentation

This document captures the complete architecture, patterns, and planned features for the lecture navigator system. Intended for agent handoff.

---

## Project Overview

A learning management system for medical students, featuring:

- Course/module navigation with lectures, labs, exams
- Full-text search across PDF content (Swedish + English)
- Content viewer with annotation/highlighting
- AI tutor and quiz functionality
- Spaced repetition extracts (SuperMemo-style)

---

## Architecture

### Frontend Stack

- **Framework:** React 18.3.1 + TypeScript 5.8.3
- **Build:** Vite 5.4.19
- **Routing:** React Router 6.30.1
- **State:** React Query 5.83.0 (server state)
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS 3.4.17
- **Icons:** lucide-react 0.462.0

### Backend Stack

- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL with FTS (pg_trgm, unaccent)
- **Port:** 8022

---

## File Structure

### Frontend (`lecture-navigator-hub/`)

```
src/
├── App.tsx                 # Routes and providers
├── pages/
│   ├── Index.tsx          # Redirect to default course
│   ├── CoursePage.tsx     # Main lecture view
│   └── NotFound.tsx       # 404 page
├── components/
│   ├── Sidebar.tsx        # Course/lecture navigation
│   ├── SearchBar.tsx      # Full-text search
│   ├── ContentGrid.tsx    # Material cards
│   ├── ContentViewer.tsx  # PDF/content viewer overlay
│   ├── RightPanel.tsx     # Quiz + AI tutor slide-in
│   ├── QuizPanel.tsx      # Multiple choice quiz
│   ├── TutorChat.tsx      # AI chat interface
│   ├── ExtractToolbar.tsx # Spaced repetition tools
│   └── ProfileMenu.tsx    # User dropdown
├── hooks/
│   └── useApi.ts          # React Query hooks
├── lib/
│   ├── api.ts             # API client
│   └── utils.ts           # cn() utility
└── data/
    └── mockData.ts        # Test data (deprecated)
```

### Backend (`content-scanner/content_scanner/`)

```
content_scanner/
├── api.py                 # FastAPI endpoints (port 8022)
├── web.py                 # Flask web UI
├── db.py                  # Database connection wrapper
├── config.py              # Configuration
├── models/
│   └── api.py             # Pydantic models
└── backend.sql            # Database schema
```

### Data Files

```
/Users/johandahlin/PycharmProjects/kandidaterna/
├── calendar.json          # Course schedules
└── content-scanner/       # Backend
```

---

## Current Routes

```typescript
/                                              → Redirect to /courses/LPG002/fysiologi_1/lectures
/courses/:courseCode/:moduleId/lectures        → CoursePage (lecture list)
/courses/:courseCode/:moduleId/lectures/:num   → CoursePage (specific lecture)
*                                              → NotFound
```

### URL Parameters

- `:courseCode` - e.g., "LPG002"
- `:moduleId` - e.g., "fysiologi_1", "fysiologi_2", "fysiologi_3"
- `:lectureNumber` - 1-based lecture number

---

## API Endpoints

### Base URL: `http://127.0.0.1:8022`

| Endpoint                      | Method | Description                 |
| ----------------------------- | ------ | --------------------------- |
| `/api/courses`                | GET    | List all courses            |
| `/api/courses/{id}/lectures`  | GET    | Lectures for course         |
| `/api/courses/{id}/labs`      | GET    | Labs for course             |
| `/api/courses/{id}/exams`     | GET    | Exams for course            |
| `/api/courses/{id}/materials` | GET    | Materials (filtered by tag) |
| `/api/content`                | GET    | All content (paginated)     |
| `/api/search?q=...`           | GET    | Full-text search            |

### Course Tag Mapping

```python
COURSE_TAG_MAP = {
    "fysiologi_1": "fysiologi",
    "fysiologi_2": "fysiologi",
    "fysiologi_3": "fysiologi",
}
```

---

## Data Models

### Course

```typescript
interface Course {
	id: string // "fysiologi_1"
	name: string // "Fysiologi 1 - Neurofysiologi"
	code: string // "LPG002"
	lecture_count: number
	lab_count: number
	exam_count: number
}
```

### Lecture

```typescript
interface Lecture {
	id: string // "fysiologi_1-lec-1"
	number: number // 1
	title: string
	date: string // "2026-01-20"
	start: string // "15:15"
	end: string // "17:00"
	duration: string // "1h 45min"
	content_count: number
	is_completed: boolean
}
```

### Exam

```typescript
interface Exam {
	id: string
	number: number
	title: string // "LPG002 Delskrivning I"
	date: string
	start: string
	end: string
	duration: string
	note?: string
}
```

### ContentItem

```typescript
interface ContentItem {
	id: string
	title: string
	type: 'book' | 'video' | 'notes' | 'exam' | 'lecture'
	description: string
	lecture_id: string | null
	page_count: number | null
	duration: string | null
	author: string | null
	tags: string[]
}
```

### SearchResult

```typescript
interface SearchResult {
	resource_id: number
	title: string
	type: string
	page_number: number
	rank: number
	snippet: string // HTML with <b> highlights
	tags: string[]
}
```

---

## Calendar.json Structure

```json
{
  "fysiologi_1": {
    "forelasningar": [
      {
        "date": "2026-01-20",
        "start": "15:15",
        "end": "17:00",
        "title": "Introduktion till neurofysiologi"
      }
    ],
    "labbar": [...],
    "tentamen": [
      {
        "date": "2026-02-24",
        "start": "08:30",
        "end": "11:30",
        "title": "LPG002 Delskrivning I",
        "note": null
      }
    ]
  },
  "fysiologi_2": {...},
  "fysiologi_3": {...}
}
```

### Course Counts

- **fysiologi_1**: 19 lectures, 7 labs, 3 exams
- **fysiologi_2**: 15 lectures, 2 labs, 3 exams
- **fysiologi_3**: 11 lectures, 7 labs, 2 exams

---

## Database Schema (PostgreSQL)

### Key Tables

- `course` - Course metadata
- `resource` - Content items (PDFs, videos)
- `resource_page` - PDF pages with dimensions
- `ocr_attempt` - OCR processing attempts
- `ocr_page` - Full-text searchable content (FTS indexes)
- `ocr_token` - Token-level data for highlighting
- `tag` / `resource_tag` - Content categorization

### FTS Configuration

- Swedish stemmer: `tsv_sv tsvector`
- English stemmer: `tsv_en tsvector`
- GIN indexes for fast search
- Trigram index for fuzzy matching

---

## Component Patterns

### Layout Structure (CoursePage)

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (288px) │ Main Content (flex-1) │ RightPanel    │
│                 │ ┌───────────────────┐ │ (slide-in)    │
│ - Course select │ │ Header (73px)     │ │               │
│ - Progress      │ │ SearchBar+Profile │ │ - Quiz        │
│ - Lectures      │ ├───────────────────┤ │ - AI Tutor    │
│ - Exams         │ │ Content Area      │ │               │
│                 │ │ - Lecture header  │ │               │
│                 │ │ - ContentGrid     │ │               │
│                 │ └───────────────────┘ │               │
└─────────────────────────────────────────────────────────┘
          └── ExtractToolbar (fixed bottom) ──┘
```

### Card Pattern (ContentGrid)

- Type badge with icon
- Title + description (truncated)
- Metadata: page count, duration
- Tags (max 2 shown)
- Hover state with shadow

### Floating Toolbar (ExtractToolbar)

- Fixed bottom center
- Selection mode toggle
- Extract/Note/Highlight/Bookmark buttons
- Priority dropdown

---

## React Query Hooks

```typescript
// Fetch all courses
useCourses()

// Fetch lectures for a module
useLectures(courseId: string | null)

// Fetch exams for a module
useCourseExams(courseId: string | null)

// Fetch materials (not fully integrated)
useCourseMaterials(courseId: string | null, limit = 50)

// Fetch content (paginated)
useContent(courseId: string | null, limit = 50, offset = 0)

// Search content (debounced)
useSearch(query: string, enabled = true)
```

---

## PLANNED FEATURE: Dashboard Pages

### User Request

> "I want a dashboard/landing page for each course, no idea what it will look like yet, but information that needs to be there is:
>
> - Link to today's course
> - Reminder that examination will be in X days
> - How many % has passed
> - Move out from old course
> - What you need to practice on
> - Link to some flash cards (not implemented yet)
> - Settings for the module
> - Breadcrumb with link back to the course (which also needs a similar landing page)
> - Calendar widget"

### Proposed Route Structure

```
/courses/:courseCode                           → Course landing (all modules)
/courses/:courseCode/:moduleId                 → Module dashboard
/courses/:courseCode/:moduleId/lectures        → Lecture list (existing)
/courses/:courseCode/:moduleId/lectures/:num   → Lecture view (existing)
```

### Module Dashboard Features

1. **Today's Lecture** - Link to current/next lecture based on date
2. **Exam Countdown** - "Delskrivning I in 42 days"
3. **Progress Tracker** - X% completed (lectures attended)
4. **Practice Areas** - Topics needing review (future)
5. **Flashcards Link** - Link to spaced repetition (not implemented)
6. **Module Settings** - Configuration (future)
7. **Breadcrumb** - LPG002 > Fysiologi 1
8. **Calendar Widget** - Mini calendar showing schedule

### Course Landing Features

- List of modules (Fysiologi 1, 2, 3)
- Overall progress across modules
- Upcoming exams across all modules
- Calendar widget

### Implementation Notes

- Calculate "days until exam" from `calendar.json` exam dates
- Calculate "today's lecture" by comparing current date to lecture dates
- Progress tracking needs backend support (currently no completion data)
- Breadcrumb component needed for navigation hierarchy

---

## Current Limitations

1. **No lecture-to-resource mapping** - ContentGrid shows empty
2. **No progress tracking** - `is_completed` always false
3. **Mock content in ContentViewer** - No real PDF rendering
4. **Selection mode non-functional** - Extracts not saved
5. **Quiz questions not from API** - Currently hardcoded
6. **Dark mode toggle exists but not implemented**

---

## CSS Custom Properties

Theme tokens in `src/index.css`:

- `--background`, `--foreground`
- `--primary`, `--secondary`, `--accent`
- `--sidebar-bg`, `--sidebar-foreground`
- `--badge-book`, `--badge-video`, `--badge-notes`, `--badge-exam`
- Dark mode variants under `.dark`

---

## Development Notes

### Running the App

```bash
# Frontend (port 8080)
cd lecture-navigator-hub
npm run dev

# Backend (port 8022)
cd content-scanner
python -m content_scanner.api
```

### Chrome DevTools

- Debug port: 9223
- MCP tools available for browser automation

### Known Warnings

- CSS `@import` must be at top of file (fixed)
- Browserslist data outdated (run `npx update-browserslist-db@latest`)
