    # Web Reviewer

A standalone web-based review interface for incremental reading, decoupled from Obsidian.

## Goals

1. **Review anywhere** - Browser-based UI accessible from any device on local network
2. **Same storage** - Uses existing markdown sidecar files (`IR/` folder)
3. **Coexist with Obsidian** - Both can read/write the same data
4. **Incremental approach** - Start with review-only, expand later

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Web Client    │─────▶│   REST API      │─────▶│   Vault (fs)    │
│   (React)       │      │   (Hono)        │      │   IR/ folder    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │                        ▲
                                ▼                        │
                         ┌─────────────────┐             │
                         │   @repo/core    │    Obsidian plugin
                         │   (reused)      │    (same files)
                         └─────────────────┘
```

### Reused from `@repo/core`

| Component              | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `FileSystem` interface | Abstract file I/O                              |
| `MarkdownDataStore`    | Read/write sidecar files in `IR/Review Items/` |
| `SessionManager`       | Queue logic, review recording, strategies      |
| `formatReviewContent`  | Render clozes for question/answer phases       |
| `buildDeckTree`        | Build folder hierarchy from items              |
| FSRS scheduling        | Grade reviews, compute next due date           |

## Code Reuse Strategy

### Extract from `@repo/obsidian` → `@repo/core`

The `EngineReviewController` contains ~600 LOC of valuable logic that's currently coupled to Obsidian. We can extract a platform-agnostic `ReviewController` to `@repo/core`.

#### Types to Move

```typescript
// @repo/core/review/types.ts

export type ReviewScreenState =
  | { type: 'folder'; decks: DeckInfo[]; selectedPath: string | null; ... }
  | { type: 'question'; content: string; debugInfo: DebugInfo; canUndo: boolean }
  | { type: 'answer'; content: string; debugInfo: DebugInfo; canUndo: boolean }
  | { type: 'finished'; sessionStats: SessionStats }

export interface DebugInfo {
  queue: string
  status: string
  priority: number
  due: string | null
  stability: number
  difficulty: number
  reps: number
  lapses: number
}

export interface SessionStats {
  reviewed: number
  again: number
  hard: number
  good: number
  easy: number
}

export interface DeckCounts {
  new: number
  learning: number
  due: number
}
```

#### Platform Adapter Interface

```typescript
// @repo/core/review/ReviewPlatform.ts

export interface ReviewPlatform {
	// Content rendering (platform-specific)
	getContent(itemId: string, phase: 'question' | 'answer'): Promise<string>

	// Stats (reads from revlog)
	getTodayStats(now: Date): Promise<TodayStats>
	getStreakInfo(now: Date): Promise<StreakInfo>

	// Optional platform hooks
	onDataChange?(callback: () => void): () => void
	updateSessionFile?(data: SessionStateData): Promise<void>
}
```

#### ReviewController (Platform-Agnostic)

```typescript
// @repo/core/review/ReviewController.ts

export class ReviewController {
	private model: ReviewModel
	private listeners = new Set<(state: ReviewScreenState) => void>()
	private sessionManager: SessionManager

	constructor(
		private dataStore: DataStore,
		private notePlatform: NotePlatform,
		private platform: ReviewPlatform,
		private config: SessionConfig,
	) {}

	// State machine
	subscribe(listener: (state: ReviewScreenState) => void): () => void
	getState(): ReviewScreenState

	// Actions (pure state transitions)
	selectDeck(path: string | null): void
	async startReview(): Promise<void>
	showAnswer(): void
	async grade(rating: 1 | 2 | 3 | 4): Promise<void>
	async skip(): Promise<void>
	async bury(): Promise<void>
	async postpone(days: number): Promise<void>
	async undo(): Promise<void>
	async suspend(): Promise<void>

	// Keyboard handling
	handleKeyDown(event: KeyboardEvent): void | Promise<void>

	// Lifecycle
	mount(): void
	unmount(): void
}
```

#### Pure Functions to Extract

```typescript
// @repo/core/review/utils.ts

export function determinePhase(item: SessionItem | null): 'question' | 'answer'
export function getQueueName(status: string): 'new' | 'learning' | 'review'
export function buildDebugInfo(item: SessionItem): DebugInfo
export function flattenDecks(decks: DeckInfo[]): DeckInfo[]
export function buildSessionStats(manager: SessionManager): SessionStats
```

### Benefits

| Package             | Before                           | After                                               |
| ------------------- | -------------------------------- | --------------------------------------------------- |
| `@repo/obsidian`    | 600 LOC `EngineReviewController` | ~100 LOC `ObsidianReviewPlatform` adapter           |
| `@repo/web`         | Build from scratch               | Reuse `ReviewController` + REST adapter             |
| `@repo/api-backend` | Stateless routes                 | Can use `ReviewController` for server-side sessions |

### Refactoring Plan

**Phase 0** (before new packages):

1. Extract types from `obsidian/src/review/` to `core/src/review/types.ts`
2. Extract pure functions to `core/src/review/utils.ts`
3. Create `ReviewPlatform` interface in `core/src/review/ReviewPlatform.ts`
4. Create `ReviewController` in `core/src/review/ReviewController.ts`
5. Refactor `EngineReviewController` to use new `ReviewController` + `ObsidianReviewPlatform`
6. Ensure Obsidian plugin still works

**Phase 1** (new packages):

1. `@repo/api-backend` creates `NodeFileSystem` and REST routes
2. REST routes use `SessionManager` directly (stateless) or `ReviewController` (stateful sessions)
3. `@repo/web` uses REST API, implements `useReviewController` hook

### Architecture After Refactoring

```
┌─────────────────────────────────────────────────────────────────┐
│                         @repo/core                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ DataStore    │  │ SessionMgr   │  │ ReviewController       │ │
│  │ FileSystem   │  │ FSRS, JD1    │  │ (state machine)        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                              │                   │
│                              ┌───────────────┼───────────────┐   │
│                              │               │               │   │
│                              ▼               ▼               ▼   │
│                    ReviewPlatform    ReviewPlatform   ReviewPlatform
│                      (interface)       (interface)     (interface)
└─────────────────────────────────────────────────────────────────┘
                              │               │               │
          ┌───────────────────┘               │               └──────────────┐
          ▼                                   ▼                              ▼
┌──────────────────┐              ┌──────────────────┐            ┌──────────────────┐
│ @repo/obsidian   │              │ @repo/api-backend│            │ @repo/web        │
│                  │              │                  │            │                  │
│ ObsidianPlatform │              │ (stateless REST) │            │ WebPlatform      │
│ (MarkdownRender) │              │                  │            │ (REST client)    │
└──────────────────┘              └──────────────────┘            └──────────────────┘
```

### New Packages

| Package             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `@repo/api-backend` | Hono REST server, Node.js FileSystem impl |
| `@repo/web`         | React SPA for review UI                   |

## REST API

### Server Usage

```bash
pnpm --filter @repo/api-backend start ./path/to/vault

# Options
#   --port 3000      Server port (default: 3000)
#   --host 0.0.0.0   Bind address (default: localhost)
```

### Endpoints

#### Review Queue

```
GET /api/queue
```

Returns today's review queue, ordered by JD1 strategy.

Query params:

- `folder` - Filter to items in this folder (optional)
- `limit` - Max items to return (default: 50)

Response:

```json
{
	"items": [
		{
			"id": "abc123",
			"noteId": "abc123",
			"notePath": "Notes/Biology/Mitochondria.md",
			"type": "cloze",
			"clozeIndex": 1,
			"priority": 75,
			"state": {
				"status": "review",
				"due": "2024-01-15T00:00:00Z",
				"stability": 21.5,
				"difficulty": 0.3,
				"reps": 5,
				"lapses": 0
			}
		}
	],
	"total": 47
}
```

#### List Folders

```
GET /api/queue/folders
```

Returns folders containing review items (for deck selection).

Response:

```json
{
	"folders": [
		{ "path": "Notes/Biology", "count": 23 },
		{ "path": "Notes/History", "count": 15 },
		{ "path": "Notes/CS", "count": 9 }
	]
}
```

#### Get Item

```
GET /api/items/:id
```

Returns item metadata and current state.

Response:

```json
{
	"id": "abc123::c1",
	"noteId": "abc123",
	"notePath": "Notes/Biology/Mitochondria.md",
	"type": "cloze",
	"clozeIndex": 1,
	"priority": 75,
	"state": {
		"status": "review",
		"due": "2024-01-15T00:00:00Z",
		"stability": 21.5,
		"difficulty": 0.3,
		"reps": 5,
		"lapses": 0
	}
}
```

#### Get Item Content

```
GET /api/items/:id/content?phase=question
GET /api/items/:id/content?phase=answer
```

Returns formatted markdown for display. Clozes are rendered appropriately:

- `question`: `The {{c1::mitochondria}} is...` → `The [...] is...`
- `answer`: `The {{c1::mitochondria}} is...` → `The **mitochondria** is...`

Response:

```json
{
	"markdown": "The [...] is the powerhouse of the cell.",
	"sourceTitle": "Mitochondria",
	"sourcePath": "Notes/Biology/Mitochondria.md"
}
```

#### Submit Review

```
POST /api/items/:id/review
```

Request:

```json
{
	"rating": 3,
	"elapsedMs": 4500
}
```

Rating values:

- `1` - Again
- `2` - Hard
- `3` - Good
- `4` - Easy

Response:

```json
{
	"state": {
		"status": "review",
		"due": "2024-01-25T00:00:00Z",
		"stability": 28.2,
		"difficulty": 0.28,
		"reps": 6,
		"lapses": 0
	},
	"interval": 10
}
```

#### Session Stats

```
GET /api/stats
```

Response:

```json
{
	"total": 150,
	"due": 47,
	"reviewed": 12,
	"remaining": 35,
	"newToday": 5,
	"reviewTime": 180000
}
```

#### Postpone Item

```
POST /api/items/:id/postpone
```

Request:

```json
{
	"days": 7
}
```

Moves item's due date forward without affecting FSRS state.

#### Set Priority

```
PUT /api/items/:id/priority
```

Request:

```json
{
	"priority": 80
}
```

#### Skip Item

```
POST /api/items/:id/skip
```

Removes item from current session queue (in-memory only, not persisted).

#### Bury Item

```
POST /api/items/:id/bury
```

Postpones item to tomorrow.

#### Media Files

```
GET /api/media/*
```

Serves files from vault for images and attachments. The web client rewrites markdown image paths:

- `![[image.png]]` → `/api/media/image.png`
- `![](attachments/diagram.png)` → `/api/media/attachments/diagram.png`

Returns file with appropriate `Content-Type` header.

## Package Structure

### `@repo/api-backend`

```
packages/api-backend/
├── src/
│   ├── index.ts              # CLI entry, arg parsing
│   ├── server.ts             # Hono app factory
│   ├── fs/
│   │   └── NodeFileSystem.ts # FileSystem impl for Node.js
│   ├── routes/
│   │   ├── queue.ts          # GET /api/queue, /api/queue/folders
│   │   ├── items.ts          # GET/POST /api/items/:id/*
│   │   ├── stats.ts          # GET /api/stats
│   │   └── media.ts          # GET /api/media/*
│   └── session/
│       └── SessionState.ts   # In-memory skip/bury tracking
├── package.json
└── tsconfig.json
```

### `@repo/web`

```
packages/web/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Router, layout
│   ├── api/
│   │   └── client.ts         # Fetch wrapper, types
│   ├── components/
│   │   ├── ReviewCard.tsx    # Item display with markdown
│   │   ├── ClozeRenderer.tsx # Cloze-aware markdown rendering
│   │   ├── RatingButtons.tsx # Again/Hard/Good/Easy
│   │   ├── ProgressBar.tsx   # Session progress
│   │   └── FolderPicker.tsx  # Deck selection
│   ├── screens/
│   │   ├── ReviewScreen.tsx  # Main review flow
│   │   └── DoneScreen.tsx    # Session complete
│   └── hooks/
│       ├── useQueue.ts       # Queue data fetching
│       └── useReview.ts      # Review submission
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Data Flow

### Review Session

```
1. User opens web app
   │
   ▼
2. GET /api/queue/folders
   │  → Display folder picker (or skip if only one)
   ▼
3. GET /api/queue?folder=Notes/Biology
   │  → Load queue into state
   ▼
4. For each item in queue:
   │
   ├─▶ GET /api/items/:id/content?phase=question
   │   → Display question
   │
   ├─▶ User clicks "Show Answer"
   │   GET /api/items/:id/content?phase=answer
   │   → Display answer
   │
   ├─▶ User rates (1-4)
   │   POST /api/items/:id/review {rating, elapsedMs}
   │   → Update state, advance to next item
   │
   └─▶ (Optional) User clicks "More"
       ├─ Skip → POST /api/items/:id/skip
       ├─ Bury → POST /api/items/:id/bury
       └─ Postpone → POST /api/items/:id/postpone {days}
   │
   ▼
5. Queue empty → Show DoneScreen with stats
```

### Image Resolution

```
1. GET /api/items/:id/content returns markdown:
   "![](attachments/diagram.png)"
   │
   ▼
2. Web client parses markdown, rewrites image src:
   <img src="/api/media/attachments/diagram.png">
   │
   ▼
3. Browser requests GET /api/media/attachments/diagram.png
   │
   ▼
4. Server reads file from vault, returns with Content-Type
```

## Tech Stack

### Backend

| Component       | Choice                      | Rationale                                       |
| --------------- | --------------------------- | ----------------------------------------------- |
| **Framework**   | Hono                        | Lightweight (14kb), TypeScript-native, portable |
| **Validation**  | Zod + `@hono/zod-validator` | Type-safe request validation                    |
| **File System** | Node.js fs/promises         | Standard, no dependencies                       |
| **Runtime**     | Node.js (Bun-ready)         | Can migrate to Bun later for speed              |

#### Hono Middleware

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { zValidator } from '@hono/zod-validator'
```

### Frontend

| Component         | Choice                      | Rationale                  |
| ----------------- | --------------------------- | -------------------------- |
| **Framework**     | React 18                    | Ecosystem, familiarity     |
| **Build Tool**    | Vite                        | Fast HMR, good defaults    |
| **Data Fetching** | TanStack Query              | Caching, refetch, devtools |
| **Markdown**      | react-markdown + remark-gfm | React-native, GFM support  |
| **Styling**       | CSS Modules                 | Scoped styles, no runtime  |

### Shared

| Component      | Choice       | Rationale                          |
| -------------- | ------------ | ---------------------------------- |
| **Core Logic** | `@repo/core` | Reuse FSRS, strategies, formatters |
| **Types**      | TypeScript   | End-to-end type safety             |

## Implementation Phases

### Phase 0: Extract ReviewController to Core

**Goal:** Decouple review logic from Obsidian before building new packages.

1. **Extract types** (~50 LOC)
    - Move `ReviewScreenState`, `DebugInfo`, `SessionStats` to `core/src/review/types.ts`
    - Move `DeckCounts` type

2. **Extract pure functions** (~30 LOC)
    - `determinePhase()`, `getQueueName()`, `buildDebugInfo()`
    - `flattenDecks()`, `buildSessionStats()`

3. **Create ReviewPlatform interface** (~20 LOC)
    - Define `getContent()`, `getTodayStats()`, `getStreakInfo()`
    - Optional hooks: `onDataChange()`, `updateSessionFile()`

4. **Create ReviewController** (~400 LOC)
    - Port state machine logic from `EngineReviewController`
    - Remove Obsidian-specific code (history, navigation)
    - Keep: `subscribe()`, `selectDeck()`, `startReview()`, `grade()`, `skip()`, `bury()`, `undo()`

5. **Create ObsidianReviewPlatform** (~100 LOC)
    - Implement `ReviewPlatform` using Obsidian APIs
    - Use `MarkdownRenderer` for `getContent()`

6. **Refactor EngineReviewController** → thin wrapper
    - Delegates to `ReviewController` + `ObsidianReviewPlatform`
    - Keeps only Obsidian-specific: history recording, view state serialization

7. **Verify Obsidian plugin still works**
    - Run existing tests
    - Manual testing

### Phase 1: Core Review Loop

**Goal:** Functional review flow with existing data.

1. Create `@repo/api-backend` package
    - `NodeFileSystem` implementation (~50 LOC)
    - Wire up `MarkdownDataStore` from core
    - Implement `/api/queue`, `/api/items/:id/content`, `/api/items/:id/review`
    - Basic CLI with vault path argument

2. Create `@repo/web` package
    - Vite + React setup
    - `useReviewController` hook using REST API
    - ReviewScreen with question/answer phases
    - Rating buttons, submit review
    - Basic progress indicator

3. Integration
    - CORS configuration
    - Test with real vault data

### Phase 2: Full Feature Parity

**Goal:** Match Obsidian plugin review features.

1. Folder filtering
    - `/api/queue/folders` endpoint
    - FolderPicker component

2. Item actions
    - Skip, bury, postpone endpoints
    - "More" menu in UI

3. Media serving
    - `/api/media/*` endpoint
    - Image path rewriting in client

4. Stats
    - `/api/stats` endpoint
    - Session summary on completion

### Phase 3: Polish

**Goal:** Production-ready experience.

1. Keyboard shortcuts
    - 1/2/3/4 for ratings
    - Space to reveal answer
    - Arrow keys for navigation

2. Mobile optimization
    - Touch-friendly buttons
    - Swipe gestures for rating

3. Offline resilience
    - Queue prefetching
    - Retry on network error

4. Settings
    - Queue size preference
    - Theme (light/dark)

### Markdown Rendering

Cloze transformation happens server-side via `formatReviewContent` from `@repo/core`:

```
Server: formatReviewContent("The {{c1::mitochondria}} is...", "cloze", "question", 1)
     → "The [...] is..."

Client: <ReactMarkdown>{markdown}</ReactMarkdown>
     → <p>The [...] is...</p>
```

The client receives pre-formatted markdown and just renders it. No cloze parsing needed in the browser.

## Open Questions

1. **Session state** - Where to track skipped items? In-memory on server, or client-side?

2. **Multi-device conflict** - Two devices reviewing same item simultaneously. Last-write-wins acceptable for MVP?

3. **Wiki links** - Obsidian `[[links]]` in content. Render as plain text for MVP, or strip them?

## Future Extensions

Once review is stable, potential additions:

- **Content creation** - Extract and cloze creation in web UI
- **PDF import** - Upload and process PDFs
- **Database migration** - Move from sidecar files to SQLite/Postgres
- **Cloud sync** - Optional remote sync for true multi-device
- **AI features** - Question generation, interleaved quizzes

---

## Quick Start (After Implementation)

```bash
# Terminal 1: Start API server
pnpm --filter @repo/api-backend start ~/Documents/MyVault

# Terminal 2: Start web dev server
pnpm --filter @repo/web dev

# Open http://localhost:5173
```
