# Architecture & Specification

This document defines the technical architecture for the Incremental Reading plugin. It serves as a specification for implementation.

---

## Design Principles

### 1. Notes are Canonical

Markdown notes are the source of truth for content. Users can edit, move, rename, or delete notes freely. The plugin adapts.

### 2. Markdown for Review State (SQLite index optional)

Canonical review state lives in Markdown sidecar files for readability and easy debugging:
- Per-cloze scheduling (since a note can have N clozes)
- Review history (append-only log)

SQLite is optional and can be introduced later as a rebuildable index for speed.

### 3. Testability First

All business logic lives in pure functions. Obsidian API interactions are isolated at boundaries.

```
Pure Functions (testable)     Boundaries (mocked in tests)
-------------------------     ----------------------------
- Scheduling calculations     - File I/O
- Queue ordering              - Obsidian metadata cache
- Date/number normalization   - UI rendering
- Cloze parsing               - User input
- Statistics aggregation
```

### 4. Lazy Loading

Heavy dependencies (if/when a SQLite index is added) are loaded on first use, not at plugin startup.

---

## Data Model

### Entities

```
Note (Markdown file)
├── Frontmatter (YAML)
│   ├── tags: [topic]
│   ├── source: "[[Parent]]"
│   ├── type: topic | item
│   ├── created: Date
│   └── priority: 0-100
│
├── Content (Markdown)
│   └── May contain clozes: {{c1::text}}, {{c2::text}}, ... (plain text, no HTML wrapper)
│
└── Derived → ReviewItem(s)
```

```
ReviewItem (what gets reviewed)
├── id: string              # "ir_note_id" for topics, "ir_note_id::cloze_uid" for items
├── noteFile: TFile         # Reference to the note
├── type: topic | item
├── clozeIndex: number?     # null for topics, 1/2/3/... for items
└── state: ItemState        # Scheduling state (from sidecar)
```

```
ItemState (scheduling)
├── status: new | learning | review | relearning
├── due: Date
├── stability: number       # FSRS: memory strength in days
├── difficulty: number      # FSRS: 0-10
├── reps: number            # Total reviews
├── lapses: number          # Times forgotten
└── last_review: Date?

### Identifiers

- `ir_note_id`: NanoID length 12
- `cloze_uid`: NanoID length 12
- Alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`
```

### Key Insight: Notes vs Items

A **Note** is a file. A **ReviewItem** is something you review.

| Note Type | Creates ReviewItems |
|-----------|---------------------|
| Topic (no clozes) | 1 topic item |
| Note with N clozes | N item items (one per cloze index) + optional topic item |

Example: `Biochemistry/Krebs Cycle/ATP yield per glucose.md` contains:
```
The Krebs cycle produces {{c1::2 ATP}}, {{c2::6 NADH}}, and {{c3::2 FADH2}} per glucose.
```

This creates three review items (IDs use `ir_note_id::cloze_uid`):
- `Ab3Kp9Xr2QaL::G7uT2mQ9rW1z` - tests "2 ATP"
- `Ab3Kp9Xr2QaL::p8Ls2ZQv6N4k` - tests "6 NADH"
- `Ab3Kp9Xr2QaL::Q9rT2mX1pL7z` - tests "2 FADH2"

Unlike Anki, SuperMemo-style incremental reading continues to treat the note as reading material even after you start creating items from it. In this plugin, a note can remain reviewable as a topic while also producing per-cloze items. (This can be made configurable later.)

### Organization: Folders as Decks

**Folders = Decks** (Anki) or **Collections** (SuperMemo)

```
Biochemistry/                           # Course/Collection
├── Krebs Cycle/                        # Lecture (Deck)
│   ├── Slides.md                       # Source material
│   ├── Lecture Notes.md
│   ├── Acetyl-CoA enters the cycle.md  # Extracts
│   └── ATP yield per glucose.md
├── Glycolysis/                         # Another lecture
│   ├── Slides.md
│   └── Net ATP from glycolysis.md
└── Electron Transport/                 # Sub-deck
    └── ...
```

**Why folders:**
- Native Obsidian concept (no extra metadata)
- Extract command places notes in source's folder
- Bases supports `file.inFolder()` filtering
- Nested folders = hierarchical decks

**No `deck` property needed** - folder path IS the deck.

### Review Flow: Two Screens

**Screen 1: Deck Summary** → **Screen 2: Review**

This mirrors Anki's flow (Decks → Study Now) but condensed to two screens.

#### Screen 1: Deck List

Shows all decks (folders with topic notes) in a tree with per-deck stats. Like Anki's main screen.

```
DeckListState {
  decks: DeckInfo[]               // Hierarchical deck tree
  selectedPath: string | null     // Currently selected deck (null = All)
  todayStats: TodayStats
  streak: StreakInfo
}

DeckInfo {
  path: string                    // "Biochemistry/Krebs Cycle"
  name: string                    // "Krebs Cycle"
  depth: number                   // 0 = root, 1 = child, etc.
  counts: {
    new: number
    learning: number
    due: number
  }
  children: DeckInfo[]            // Nested folders
  collapsed: boolean              // UI state
}

TodayStats {
  reviewed: number
  again: number
  hard: number
  good: number
  easy: number
}

StreakInfo {
  current: number
  longest: number
}
```

**Building the Deck Tree:**

```typescript
function buildDeckTree(reviewItems: ReviewItem[]): DeckInfo[] {
  // 1. Get all unique folder paths from sidecar note_path fields
  // 2. Build hierarchical tree from paths
  // 3. For each folder, count items by status
  // 4. Return tree structure
}

function getCountsForFolder(items: ReviewItem[], folderPath: string): Counts {
  // Filter by folder prefix, then count by status/due
}
```

**Preselection Logic:**
1. Get active file's folder path
2. Find matching deck in tree
3. If found → select that deck
4. If not → select "All Decks"

**Data Sources:**
- Deck tree + counts: Built from sidecar files under `IR/Review Items/` (or an optional SQLite index)
- Today's stats: Calculated from revlog JSONL entries for today
- Streak: Calculated from revlog daily review dates

#### Screen 2: Review

Standard card review with **always-editable content** (core IR principle).

Unlike Anki (read-only during review), content is always editable - no mode switching:
- Notes remain editable in Obsidian's normal editor while reviewing
- Select text → Extract (`Alt+X`) or Cloze (`Alt+Z`)
- Type to edit inline
- Grade with 1-4 keys when ready
- Press `Esc` → returns to Deck List

```typescript
ReviewScreenState {
  phase: 'question' | 'answer'    // Only for items (cloze hide/reveal)
  currentItem: ReviewItem | null
  sessionStats: SessionStats
}
```

**For Topics**: Note is editable; review panel can show progress + grading.
**For Items**: Note is editable; the editor visually hides the answer text for the active cloze index in question phase (without modifying the file), and reveals in answer phase.

To avoid spoilers, the review header should not show the note title or breadcrumb trail; show only the selected deck/folder.

#### Navigation Flow

```
Open Review (Cmd+Shift+R)
         │
         ▼
┌─────────────────┐
│  Deck List      │◄────────────┐
│                 │             │
│  [Study Now]    │             │ Esc
│  [Select Deck]  │             │
└────────┬────────┘             │
         │ Study Now            │
         ▼                      │
┌─────────────────┐             │
│    Review       │─────────────┘
│  (always edit)  │
│                 │
│  Read/Edit/Cloze│
│  [Grade 1-4]    │
│  [Esc = Back]   │
└─────────────────┘
         │
         │ Queue empty
         ▼
┌─────────────────┐
│  Complete!      │
│  Next due: ...  │
│  [Back to Deck] │
└─────────────────┘
```

No separate edit mode - content is always editable during review.

### Queue Building

```typescript
function buildQueue(
  items: ReviewItem[],
  now: Date,
  options: {
    newCardsPerDay: number,
    newCardsToday: number,
    folderFilter?: string,  // e.g., "Biochemistry/Krebs Cycle"
    includeSubfolders?: boolean,  // default: true
  }
): ReviewQueue
```

Folder filtering:
- `folderFilter: null` → all items
- `folderFilter: "Biochemistry"` + `includeSubfolders: true` → Krebs Cycle + Glycolysis + etc.
- `folderFilter: "Biochemistry/Krebs Cycle"` + `includeSubfolders: false` → just Krebs Cycle

---

## Storage

### Storage Strategy

| Data | Primary Storage | Why |
|------|-----------------|-----|
| Note identity (`tags`, `source`, `type`, `ir_note_id`) | Frontmatter | Defines what's reviewable |
| Note-level settings (`priority`) | Frontmatter | User-editable, shared by all clozes |
| Reading position (`scroll_pos`) | Frontmatter | Topics only, persists across reviews |
| Per-cloze scheduling | Sidecar Markdown (`IR/Review Items/<ir_note_id>.md`) | Readable, per-note state |
| Review history | Markdown log (`IR/Revlog/YYYY-MM.md`) | Append-only, easy to inspect |

**Principle**: Notes + sidecars + revlogs are canonical. A SQLite index may be added later for speed.

### Syncing Notes ↔ Sidecars

Use Obsidian's vault events to keep in sync:

```typescript
// Listen for file changes
this.registerEvent(
  app.vault.on('modify', (file) => {
    if (hasTopicTag(file)) {
      syncNoteToSidecar(app, file, extractTag);
    }
  })
);

// Listen for file deletion
this.registerEvent(
  app.vault.on('delete', (file) => {
    deleteSidecarForNote(file);
  })
);

// Listen for file rename
this.registerEvent(
  app.vault.on('rename', (file, oldPath) => {
    updateSidecarNotePath(oldPath, file.path);
  })
);
```

**Sync triggers:**
- Plugin load → full sync (notes → sidecars)
- File modify → sync that note
- File delete → remove orphaned items
- File rename → update item paths
- After grading → update sidecar + append to revlog

### Default Value Policy

**Only write non-default values to frontmatter** to keep notes clean.

| Property | Default | Write if... |
|----------|---------|-------------|
| `tags` | - | Always (required) |
| `source` | - | Has parent note |
| `type` | `topic` | Has clozes → `item` |
| `created` | - | Always (for sorting) |
| `ir_note_id` | - | Always (stable identity) |
| `priority` | `50` | Changed from default |
| `scroll_pos` | `0` | Topic with scroll > 0 |

**Minimal frontmatter example** (new topic):
```yaml
---
tags: [topic]
source: "[[Slides]]"
created: 2024-01-15T10:30:00
ir_note_id: "Ab3Kp9Xr2QaL"
---
```

**Full frontmatter example** (edited topic with custom priority):
```yaml
---
tags: [topic]
source: "[[Slides]]"
type: item
created: 2024-01-15T10:30:00
ir_note_id: "Ab3Kp9Xr2QaL"
priority: 20
scroll_pos: 450
---
```

### Bases Compatibility

Bases can read frontmatter from Markdown files. Review state is stored in sidecars under `IR/Review Items/`, so Bases views should target those files.

Two options for what Bases sees:

**Option A: Summary properties** (simple views)
```yaml
cloze_count: 3
due_count: 2           # How many clozes are due
next_due: 2024-01-20   # Earliest due date
```

**Option B: Per-cloze map** (full visibility)
```yaml
clozes:
  c1: { cloze_uid: Ab3Kp9Xr2QaL, status: review, due: 2024-01-20, stability: 15.2 }
  c2: { cloze_uid: Q9rT2mX1pL7z, status: new }
```

For MVP/debuggability, Option B is acceptable; summary fields can be added later if needed.

### Note Frontmatter (Complete Schema)

```yaml
---
# Required
tags: [topic]
ir_note_id: "Ab3Kp9Xr2QaL"

# Optional - context
source: "[[Parent Note]]"    # Where this was extracted from
created: 2024-01-15T10:30:00 # Creation timestamp

# Optional - classification
type: topic | item           # Default: topic (inferred from clozes)

# Optional - user settings
priority: 50                 # 0-100, default 50

# Optional - reading state (topics only)
scroll_pos: 450              # Pixel offset, default 0

# Optional - Bases summary (written by plugin)
cloze_count: 3               # Number of clozes in note
due_count: 2                 # Clozes due for review
next_due: 2024-01-20         # Earliest due date
---
```

### Review Item Sidecar (Canonical State)

Path: `IR/Review Items/<ir_note_id>.md`

```yaml
---
ir_note_id: "Ab3Kp9Xr2QaL"
note_path: "Biochemistry/Krebs Cycle/ATP.md"
clozes:
  c1:
    cloze_uid: "G7uT2mQ9rW1z"
    status: review
    due: 2024-01-20T10:00:00
    stability: 15.2
    difficulty: 5.5
    reps: 8
    lapses: 1
    last_review: 2024-01-18T14:00:00
  c2:
    cloze_uid: "p8Ls2ZQv6N4k"
    status: new
    due: null
    stability: 0
    difficulty: 0
---
```

### Review Log (Append-Only)

Path: `IR/Revlog/YYYY-MM.md`

Format: JSONL, one object per line (no header/frontmatter):
```json
{"ts":"2024-01-15T10:30:00.000Z","item_id":"Ab3Kp9Xr2QaL::G7uT2mQ9rW1z","rating":3,"elapsed_ms":2500,"state_before":"review","stability_before":15.2,"difficulty_before":5.5}
```

### Optional SQLite Index (Future)

A rebuildable SQLite index can be added later for speed. It mirrors sidecars and revlog data but is not canonical.

---

## Module Structure

```
src/
├── core/                    # Pure functions (fully testable)
│   ├── types.ts             # Type definitions
│   ├── scheduling.ts        # FSRS calculations, grade logic
│   ├── queue.ts             # Queue building and ordering
│   ├── cloze.ts             # Cloze parsing and manipulation
│   ├── frontmatter.ts       # Frontmatter parsing/serialization
│   └── dates.ts             # Date utilities
│
├── data/                    # Data access layer
│   ├── review-items.ts      # Sidecar read/write
│   ├── revlog.ts            # JSONL append/read
│   └── sync.ts              # Note → Sidecar synchronization
│
├── editor/                  # Editor extensions
│   └── cloze-hider.ts        # Hide/reveal cloze answers in editor
│
├── stats/                   # Statistics (pure where possible)
│   ├── aggregations.ts      # Compute stats from revlog entries
│   └── charts.ts            # Chart data preparation (pure)
│
├── commands/                # Obsidian command handlers
│   ├── extract.ts
│   └── cloze.ts
│
├── views/                   # UI components
│   ├── review/
│   │   ├── ReviewItemView.tsx
│   │   ├── ReviewView.tsx
│   │   └── ...
│   └── stats/
│       ├── StatsModal.tsx
│       └── ...
│
├── settings.ts              # Plugin settings
└── main.ts                  # Plugin entry point
```

---

## Pure Function Signatures

### core/scheduling.ts

```typescript
// Calculate new state after grading
function gradeItem(
  state: ItemState,
  rating: Rating,
  now: Date,
  fsrsParams: FsrsParams
): ItemState

// Topic-specific grading (simpler intervals)
function gradeTopic(
  state: ItemState,
  rating: Rating,
  now: Date
): ItemState

// Map user grade (1-4) to FSRS Rating
function mapGradeToRating(grade: number): Rating

// Calculate burden (workload estimate)
function calculateBurden(items: ItemState[]): number
```

### core/queue.ts

```typescript
// Build queue from items
function buildQueue(
  items: ReviewItem[],
  now: Date,
  newCardsPerDay: number,
  newCardsToday: number
): ReviewQueue

// Get next item to review
function getNextItem(queue: ReviewQueue): ReviewItem | null

// Sort items by priority rules
function sortByPriority(items: ReviewItem[]): ReviewItem[]

// Categorize items into queue buckets
function categorizeItems(
  items: ReviewItem[],
  now: Date
): { learning: ReviewItem[], due: ReviewItem[], new: ReviewItem[], upcoming: ReviewItem[] }
```

### core/cloze.ts

```typescript
// Extract cloze indices from note content
function parseClozeIndices(content: string): number[]

// Get next available cloze index
function getNextClozeIndex(content: string): number

// Get highest existing cloze index
function getHighestClozeIndex(content: string): number | null

// Format cloze for display (hiding answer)
function formatClozeQuestion(content: string, clozeIndex: number): string

// Format cloze with answer revealed
function formatClozeAnswer(content: string, clozeIndex: number): string
```

### core/frontmatter.ts

```typescript
// Parse frontmatter into typed object
function parseFrontmatter(raw: Record<string, unknown>): NoteFrontmatter | null

// Serialize frontmatter for writing
function serializeFrontmatter(fm: NoteFrontmatter): Record<string, unknown>

// Normalize tags (handles #prefix, arrays, strings)
function normalizeTags(tags: unknown): string[]

// Parse date from various formats
function parseDate(value: unknown): Date | null

// Format date for frontmatter
function formatDate(date: Date): string

// Normalize number with fallback
function normalizeNumber(value: unknown, fallback: number): number
```

### core/dates.ts

```typescript
// Add days to date
function addDays(date: Date, days: number): Date

// Add minutes to date
function addMinutes(date: Date, minutes: number): Date

// Check if date is today
function isToday(date: Date, now: Date): boolean

// Get start of day
function startOfDay(date: Date): Date

// Days between two dates
function daysBetween(a: Date, b: Date): number
```

### stats/aggregations.ts

```typescript
// Calculate retention rate
function calculateRetention(reviews: ReviewRecord[]): number

// Calculate streak
function calculateStreak(reviewDays: Date[], today: Date): StreakInfo

// Group reviews by date
function groupByDate(reviews: ReviewRecord[]): Map<string, ReviewRecord[]>

// Calculate answer distribution
function calculateAnswerDistribution(reviews: ReviewRecord[]): AnswerDistribution

// Build heatmap data
function buildHeatmapData(reviews: ReviewRecord[], days: number): HeatmapData[]

// Build forecast data
function buildForecastData(items: ItemState[], days: number, now: Date): ForecastData[]
```

---

## Data Flow

### Opening Review

```
1. User opens Review view

2. Load items from sidecar files
   items = loadSidecarItems()

3. Load note metadata (for priority, type)
   for each item:
     note = vault.getFile(item.note_path)
     fm = readFrontmatter(note)
     item.priority = fm.priority

4. Build queue (pure function)
   queue = buildQueue(items, now, settings.newCardsPerDay, todayNewCount)

5. Render first item
   current = getNextItem(queue)
   render(current)
```

### Grading an Item

```
1. User grades item (e.g., grade = 3)

2. Calculate new state (pure function)
   if item.type == 'topic':
     newState = gradeTopic(item.state, grade, now)
   else:
     newState = gradeItem(item.state, grade, now, fsrsParams)

3. Persist to sidecar
   updateSidecarItem(item.id, newState)

4. Log review (for stats)
   appendRevlog({
     ts: now,
     item_id: item.id,
     rating: grade,
     elapsed_ms: elapsedTime,
     state_before: item.state.status,
     stability_before: item.state.stability,
     difficulty_before: item.state.difficulty,
   })

5. Advance to next item
   current = getNextItem(queue)
   render(current)
```

### Adding a Cloze

```
1. User selects text, runs "Create Cloze"

2. Calculate index (pure function)
   content = editor.getValue()
   index = getNextClozeIndex(content)

3. Wrap selection
   clozeText = `{{c${index}::${selection}}}`
   editor.replaceSelection(clozeText)

4. Update note frontmatter
   if fm.type != 'item':
     fm.type = 'item'
     writeFrontmatter(file, fm)

5. Create sidecar entry
   upsertSidecarCloze({
     id: `${ir_note_id}::${cloze_uid}`,
     note_path: file.path,
     cloze_index: index,
     status: 'new',
     due: now,
     stability: 0,
     difficulty: 0,
     reps: 0,
     lapses: 0,
     last_review: null,
   })
```

### Sync on Startup

When plugin loads, synchronize sidecars with vault:

```
1. Get all notes with topic tag
   notes = getNotesWithTag(vault, settings.extractTag)

2. Get all sidecar items
   items = getAllSidecarItems()

3. For each note:
   a. Parse clozes from content
      clozeIndices = parseClozeIndices(note.content)

   b. If no clozes and type is topic:
      - Ensure single topic entry exists in sidecar

   c. If has clozes:
      - Ensure sidecar entry for each cloze index
      - Remove stale entries (cloze deleted)

4. Remove orphaned sidecars (note deleted)
   for each item:
     if note doesn't exist:
       deleteSidecar(item.id)
```

---

## Bases Views

The plugin creates Bases views for browsing items.

### View: All Items

File: `IR/All Items.base`

Shows all review items with columns:
- File (link to note)
- Type (topic/item)
- Cloze (c1, c2, ... or empty)
- Status
- Priority
- Due
- Stability
- Difficulty
- Reps
- Lapses
- Source

Filter: `file.inFolder("IR/Review Items")`

### View: Due Today

File: `IR/Due Today.base`

Filter: `due <= today AND status != new`

Columns: File, Type, Cloze, Priority, Due, Stability

### View: New

File: `IR/New.base`

Filter: `status = new`

Columns: File, Type, Cloze, Priority, Created

### View: Struggling

File: `IR/Struggling.base`

Filter: `lapses >= 3`

Columns: File, Type, Cloze, Lapses, Difficulty, Stability, Last Review

### View: Topics Only

File: `IR/Topics.base`

Filter: `type = topic`

### View: Items Only

File: `IR/Items.base`

Filter: `type = item`

### Per-Folder Views (Deck Views)

Users can create folder-specific views. Example for Krebs Cycle lecture:

File: `Biochemistry/Krebs Cycle/Queue.base`

```base
filters:
  and:
    - file.inFolder("IR/Review Items")
    - note_path: contains "Biochemistry/Krebs Cycle/"
views:
  - type: table
    name: Due
    filters:
      and:
        - status: is not "new"
        - due: is on or before today
  - type: table
    name: New
    filters:
      and:
        - status: is "new"
  - type: table
    name: All
```

This shows New/Learning/Due tabs for just that lecture folder.

For the entire course:

File: `Biochemistry/All Items.base`

```base
filters:
  and:
    - file.inFolder("IR/Review Items")
    - note_path: contains "Biochemistry/"
```

This includes all items from Krebs Cycle, Glycolysis, etc.

### Implementation Note

Bases reads frontmatter from Markdown files. For per-cloze data, the plugin stores state in the sidecar files under `IR/Review Items/`.

```yaml
clozes:
  c1: { cloze_uid: Ab3Kp9Xr2QaL, status: review, due: 2024-01-20, stability: 15.2 }
  c2: { cloze_uid: Q9rT2mX1pL7z, status: new, due: null, stability: 0 }
```

---

## Statistics Inputs

Statistics are computed from:
- Revlog entries parsed from `IR/Revlog/YYYY-MM.md` (JSONL)
- Sidecar state from `IR/Review Items/<ir_note_id>.md`

Aggregation is done by pure functions:
- Heatmap data from daily review counts
- Retention rate from ratings (>= 2)
- Answer distribution by rating
- Reviews over time grouped by day and prior state
- Streak from daily review dates
- Forecast from item due dates

If an optional SQLite index is added later, it can mirror these inputs for faster querying.

---

## Error Handling

### Index Errors (Optional)

- If a SQLite index fails to load: Continue without index, log warning

### Note Sync Errors

- If note can't be read: Skip, log warning
- If frontmatter invalid: Use defaults, log warning

### Review Errors

- If current item disappears (deleted): Refresh queue, continue
- If grade fails to persist: Show error notice, don't advance

---

## Testing Strategy

Testing is deferred until the core workflow is stable end-to-end.

---

## Current Implementation Status

This section documents what is actually implemented vs. the target architecture above.

### Implemented (Working)

**Cloze Syntax & Display:**
- Plain Anki-style clozes: `{{c1::text}}` or `{{c1::text::hint}}` (no HTML wrapper)
- Question phase: CodeMirror editor extension hides cloze content with `[...]` placeholder
- Answer phase: Text replacement shows `**[answer]**` via `revealClozes()` function
- Cloze creation command inserts plain syntax

**Review UI:**
- Header shows deck/folder name only (not breadcrumbs) to avoid spoilers
- Completion screen with session stats (cards reviewed, again/hard/good/easy counts)
- Next due date shown when queue empty
- Grade buttons (1-4) with color coding

**Revlog:**
- Append-only Markdown list format in `IR/RevLog/<machineId>.md`
- Format: `- timestamp | path | grade=N | type=X | status=Y | due=Z`
- Race condition handling for concurrent writes

### Gap: Per-File vs. Per-Cloze Scheduling

**Current (simplified):**
- Queue built from notes with `#topic` tag
- One queue entry per file (not per cloze)
- Scheduling state stored in note frontmatter

**Target (not yet implemented):**
- Per-cloze scheduling via sidecar files (`IR/Review Items/<ir_note_id>.md`)
- Each cloze gets its own `cloze_uid` and scheduling state
- Queue contains N entries for a note with N clozes

### Gap: Revlog Format

**Current:** Plain Markdown list
```markdown
- 2024-01-15T10:30:00 | path/to/note.md | grade=3 | type=item | status=review | due=2024-01-20T10:00:00
```

**Target:** JSONL for easier parsing
```json
{"ts":"2024-01-15T10:30:00.000Z","item_id":"Ab3Kp9Xr2QaL::G7uT2mQ9rW1z","rating":3}
```

### Gap: Deck List Screen

**Current:** Review opens directly to card review
**Target:** Two-screen flow (Deck List → Review)

### File Locations

| Component | Current Location | Target Location |
|-----------|------------------|-----------------|
| Revlog | `IR/RevLog/<machineId>.md` | `IR/Revlog/YYYY-MM.md` |
| Sidecar | (not implemented) | `IR/Review Items/<ir_note_id>.md` |
| Scheduling | Note frontmatter | Sidecar files |

### Source Tree Structure

The codebase has two source trees:

| Tree | Purpose | Status |
|------|---------|--------|
| `src/` | Original implementation (Markdown revlog, per-file scheduling) | Legacy |
| `src2/` | New implementation (JSONL revlog, per-cloze scheduling) | Active |

The build uses `src2/` for the main plugin. Key files:

**src2/ (Active)**
| File | Purpose |
|------|---------|
| `src2/data/revlog.ts` | JSONL revlog in `IR/Revlog/YYYY-MM.md` |
| `src2/data/review-items.ts` | Sidecar files in `IR/Review Items/<id>.md` |
| `src2/data/sync.ts` | Note ↔ sidecar synchronization |
| `src2/core/types.ts` | Type definitions |

**src/ (Legacy, partially used)**
| File | Purpose |
|------|---------|
| `src/views/review/MarkdownBlock.tsx` | Cloze rendering (CodeMirror decorations) |
| `src/views/review/ReviewView.tsx` | Main review UI |
| `src/commands/cloze.ts` | Cloze creation command |
| `src/scheduling/queue.ts` | Queue building (per-file) |

### Race Condition Handling

All file creation operations use try/catch to handle race conditions:

```typescript
// Pattern for file creation
const existing = app.vault.getAbstractFileByPath(path);
if (existing instanceof TFile) {
    await app.vault.append(existing, content);
    return;
}
try {
    await app.vault.create(path, content);
} catch {
    // File created between check and create - fallback
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
        await app.vault.append(file, content);
    }
}
```

This pattern is applied in:
- `src2/data/revlog.ts:appendReview()`
- `src2/data/review-items.ts:writeReviewItemFile()`
- `src/revlog.ts:appendRevlog()`

Folder creation also handles races:
```typescript
const folder = app.vault.getAbstractFileByPath(path);
if (!folder) {
    try {
        await app.vault.createFolder(path);
    } catch {
        // Already created by another operation
    }
}
```

---

## Dependencies

| Package | Purpose | Size | Loaded |
|---------|---------|------|--------|
| ts-fsrs | Scheduling algorithm | ~15KB | Always |
| frappe-charts | Statistics charts | ~17KB | Lazy (stats modal) |
| preact | UI components | ~4KB | Always |

---

## Migration

### From Current Implementation

Current: Note frontmatter stores all scheduling.
New: Per-cloze scheduling moves to sidecar files under `IR/Review Items/`.

Migration on first load:
1. For each note with topic tag:
   - Ensure `ir_note_id` exists
   - Create/update sidecar with per-cloze entries
2. Mark migration complete in settings

### Data Export

Provide CSV export for revlog:
```
timestamp,item_id,rating,elapsed_ms,state_before
2024-01-15T10:30:00,notes/Cells.md::c1,3,2500,review
```

---

## Future Enhancements (Post-MVP)

### Alternative Card Types

**MVP**: Cloze deletions only (`{{c1::text}}`).

**Future**: Support additional card types.

#### Basic Q&A Cards

Syntax option 1 (Anki-style):
```markdown
Q: What is the capital of France?
A: Paris
```

Syntax option 2 (frontmatter):
```markdown
---
type: qa
---
What is the capital of France?
---
Paris
```

Implementation:
- Parse Q/A markers or separator
- Item ID: `ir_note_id::qa` (one Q&A per note) or `ir_note_id::qa1` (multiple)
- Question phase: show Q, hide A
- Answer phase: reveal A

#### Image Occlusion Cards

**Significant complexity** - requires:
1. Image annotation editor (canvas overlay)
2. Storage of occlusion regions (coordinates, shapes)
3. Render-time masking of regions
4. Per-region scheduling

Syntax concept:
```markdown
![[diagram.png]]
<!-- occlusions:
  - id: 1, type: rect, x: 100, y: 50, w: 80, h: 30, label: "mitochondria"
  - id: 2, type: rect, x: 200, y: 100, w: 60, h: 40, label: "nucleus"
-->
```

Item IDs: `ir_note_id::img1::o1`, `ir_note_id::img1::o2`

**Not MVP** - requires dedicated editor UI.

### Card Type Detection

```typescript
function detectCardType(content: string, frontmatter: any): CardType {
  if (hasClozes(content)) return 'cloze';
  if (hasQAMarkers(content)) return 'qa';
  if (hasOcclusionMarkers(content)) return 'occlusion';
  return 'topic';  // Default: reading material
}
```

### Priority for MVP

1. **Cloze deletions** - Core IR workflow, validates the concept
2. **Topics** - Reading material with scroll position
3. ~~Q&A cards~~ - Post-MVP, simple addition
4. ~~Image occlusion~~ - Post-MVP, significant work
