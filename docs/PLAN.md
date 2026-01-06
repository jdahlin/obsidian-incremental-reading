# Incremental Reading Plugin - Implementation Plan

## Overview

This document outlines the implementation plan for completing the Obsidian Incremental Reading plugin. The goal is to build a functional spaced repetition system for reading material with proper scheduling, cloze deletions, and a polished review interface.

## Current State

### Working Features
- **Extract command**: Extracts selected text into a new note with `#extract` tag and source link
- **Cloze command**: Wraps text in `{{c1::text}}` format with CSS hiding
- **Review view**: React-based ItemView with keyboard navigation (1-4 grading, Enter/Space to advance)
- **Tag-based discovery**: Finds cards via `#extract` tag using Obsidian's metadata cache

### Technical Debt
- React 18 (~40KB) is heavyweight for this use case
- Custom esbuild CSS plugin adds complexity
- No scheduling algorithm (cards just cycle round-robin)
- No persistence of review state

---

## Architecture Decisions

### Obsidian Bases Integration

Obsidian 1.9 introduced Bases - native database views that query notes by frontmatter properties. We leverage this for browsing/filtering cards without building custom UI.

**Approach**:
- Store scheduling data as flat frontmatter properties (not nested)
- Create `.base` files in `IR/` folder on plugin load via `vault.adapter`
- Users get native table views for "Due Today", "All Cards", etc.
- Plugin provides the review UI and FSRS scheduling logic

**Why flat properties?** Bases can only query top-level frontmatter fields. Nested structures like `fsrs.due` don't work.

### Frontmatter Schema (Bases-compatible)

```yaml
---
source: "[[parent-note]]"      # Immediate parent (supports nested extracts A->B->C)
tags: [extract]
type: topic                    # topic | item (topic = reading, item = cloze/testing)
created: 2026-01-06T10:30:00   # Full datetime
due: 2026-01-07T09:00:00       # Next review datetime
status: new                    # new | learning | review | relearning
priority: 50                   # 0-100, optional manual override
stability: 0.4                 # FSRS memory stability
difficulty: 0                  # FSRS difficulty (0-10)
reps: 0                        # Successful repetitions
lapses: 0                      # Times forgotten
last_review:                   # Last review timestamp
scroll_pos: 0                  # Last cursor position (offset) for resuming reading
---
```

Bases supports full ISO 8601 datetime with `YYYY-MM-DDTHH:mm:ss` format. This enables precise scheduling (e.g., learning cards due in 10 minutes).

**Nested Extracts**: The `source` field always points to the immediate parent file. This creates a natural hierarchy (Note A -> Extract B -> Extract C) without complex management.

### State Model

#### Status Mapping (String ↔ FSRS Numeric)
```typescript
const STATUS_MAP = {
  'new': 0,        // State.New
  'learning': 1,   // State.Learning
  'review': 2,     // State.Review
  'relearning': 3, // State.Relearning
} as const;

type Status = keyof typeof STATUS_MAP;

// Frontmatter uses string, FSRS uses number
function statusToFsrs(status: Status): number { return STATUS_MAP[status]; }
function fsrsToStatus(state: number): Status { ... }
```

#### Type: Topic vs Item
| Type | Purpose | Scheduling | UI |
|------|---------|------------|-----|
| `topic` | Reading material (articles, sections) | Simple intervals, priority-based | Show content, track scroll_pos |
| `item` | Active recall (clozes, Q&A) | Full FSRS algorithm | Hide answer, reveal on demand |

**Creation rules**:
- `Extract` command → `type: topic`, `tags: [extract]` (reading material)
- `Cloze` command on existing extract → changes `type` to `item` (keeps `#extract` tag)
- `Cloze` command on non-extract → creates new note with `type: item`, `tags: [extract]` (enters queue)
- User can manually edit `type` in frontmatter

#### Full CardState Interface
```typescript
interface CardState {
  // Identity
  source: string;           // Wikilink to parent
  type: 'topic' | 'item';

  // Scheduling (shared)
  created: Date;
  due: Date;
  status: Status;           // 'new' | 'learning' | 'review' | 'relearning'
  priority: number;         // 0-100, user-editable
  last_review: Date | null;

  // FSRS fields (primarily for items, but tracked for all)
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;

  // Topic-specific
  scroll_pos: number;       // Reading position (offset)
}
```

### Priority & Queue Strategy

#### Queue Order (v1)
1. **Learning/Relearning** cards (due now) — sorted by `due` ascending
2. **Review** cards (due today) — sorted by `priority` asc, then `due` asc
3. **New** cards — sorted by `priority` asc, then `created` asc

Priority uses SuperMemo convention: **lower number = higher priority** (0 = most important, 100 = least). Priority 0 cards surface first.

#### Overload Handling (v1 - Simple)
- Setting: `maxReviewsPerDay` (default: unlimited)
- If queue exceeds limit, defer lowest-priority cards to tomorrow
- No auto-postpone algorithm yet (future enhancement)

### Timezone Convention
- All datetimes stored as **local time** without timezone suffix
- Format: `YYYY-MM-DDTHH:mm:ss`
- Comparisons use device's local time
- Cross-device sync: user's responsibility (same timezone assumed)

### Context Recovery

#### Breadcrumb Navigation
The `source` chain provides natural breadcrumbs:
```
Article A → Section B → Paragraph C
```

UI shows clickable path: `A > B > C`

Implementation:
```typescript
async function getBreadcrumbs(app: App, file: TFile): Promise<TFile[]> {
  const chain: TFile[] = [file];
  let current = file;

  while (true) {
    const fm = app.metadataCache.getFileCache(current)?.frontmatter;
    const sourceLink = fm?.source;
    if (!sourceLink) break;

    const parent = app.metadataCache.getFirstLinkpathDest(
      sourceLink.replace(/^\[\[|\]\]$/g, ''),
      current.path
    );
    if (!parent || chain.includes(parent)) break;

    chain.unshift(parent);
    current = parent;
  }

  return chain;
}
```

### IR/ Folder Structure

Created on first plugin load:
```
IR/
├── Due Today.base
├── Topics.base
├── Items.base
├── New Cards.base
├── Learning.base
├── All Extracts.base
└── By Source.base
```

### Base File Definitions

**Due Today.base**
```yaml
filters:
  and:
    - file.hasTag("extract")
    - "due <= now()"
    - "status != 'new'"

formulas:
  days_overdue: "max(0, (now() - due) / (1000 * 60 * 60 * 24))"

properties:
  type:
    displayName: "Type"
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  source:
    displayName: "Source"
  formula.days_overdue:
    displayName: "Days Overdue"

views:
  - type: table
    name: "Due for Review"
    order:
      - type
      - due
      - file.name
```

**Topics.base** (Reading material)
```yaml
filters:
  and:
    - file.hasTag("extract")
    - "type == 'topic'"

formulas:
  progress: "if(scroll_pos > 0, 'In Progress', 'Not Started')"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  priority:
    displayName: "Priority"
  source:
    displayName: "Source"
  formula.progress:
    displayName: "Progress"

views:
  - type: table
    name: "All Topics"
    order:
      - priority
      - due
  - type: table
    name: "Due Topics"
    filters:
      and:
        - "due <= now()"
    order:
      - due
```

**Items.base** (Active recall / Clozes)
```yaml
filters:
  and:
    - file.hasTag("extract")
    - "type == 'item'"

formulas:
  health: "if(lapses > 3, 'Struggling', if(stability > 10, 'Strong', 'Normal'))"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  stability:
    displayName: "Stability"
  lapses:
    displayName: "Lapses"
  source:
    displayName: "Source"
  formula.health:
    displayName: "Health"

views:
  - type: table
    name: "All Items"
    order:
      - status
      - due
  - type: table
    name: "Due Items"
    filters:
      and:
        - "due <= now()"
    order:
      - due
```

**New Cards.base**
```yaml
filters:
  and:
    - file.hasTag("extract")
    - "status == 'new'"

properties:
  created:
    displayName: "Created"
  source:
    displayName: "Source"
  priority:
    displayName: "Priority"

views:
  - type: table
    name: "New Cards"
    order:
      - priority
      - created
```

**Learning.base**
```yaml
filters:
  and:
    - file.hasTag("extract")
    - or:
      - "status == 'learning'"
      - "status == 'relearning'"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  lapses:
    displayName: "Lapses"

views:
  - type: table
    name: "In Learning"
    order:
      - due
```

**All Extracts.base**
```yaml
filters:
  - file.hasTag("extract")

formulas:
  next_review: "if(due < now(), 'Overdue', due)"
  health: "if(lapses > 3, 'Struggling', if(stability > 10, 'Strong', 'Normal'))"

properties:
  status:
    displayName: "Status"
  due:
    displayName: "Next Review"
  stability:
    displayName: "Stability"
  reps:
    displayName: "Reps"
  lapses:
    displayName: "Lapses"
  source:
    displayName: "Source"

views:
  - type: table
    name: "All Cards"
    order:
      - status
      - due
  - type: table
    name: "By Stability"
    order:
      - stability
      - file.name
```

**By Source.base**
```yaml
filters:
  - file.hasTag("extract")

properties:
  source:
    displayName: "Source"
  status:
    displayName: "Status"
  due:
    displayName: "Due"

views:
  - type: table
    name: "Grouped by Source"
    order:
      - source
      - due
```

### Base Files Setup Code

```typescript
// src/bases/setup.ts
const BASE_FILES: Record<string, string> = {
  'Due Today.base': DUE_TODAY_YAML,
  'Topics.base': TOPICS_YAML,
  'Items.base': ITEMS_YAML,
  'New Cards.base': NEW_CARDS_YAML,
  'Learning.base': LEARNING_YAML,
  'All Extracts.base': ALL_EXTRACTS_YAML,
  'By Source.base': BY_SOURCE_YAML,
};

export async function ensureBasesFolder(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  const folderPath = 'IR';

  // Create folder if missing
  if (!await adapter.exists(folderPath)) {
    await adapter.mkdir(folderPath);
  }

  // Write base files (skip if already exist to preserve user edits)
  for (const [filename, content] of Object.entries(BASE_FILES)) {
    const filePath = `${folderPath}/${filename}`;
    if (!await adapter.exists(filePath)) {
      await adapter.write(filePath, content);
    }
  }
}
```

---

## Phase 1: Build Simplification + Preact Migration

### Rationale
Preact is ~3KB (vs React's ~40KB), has the same API via `preact/compat`, and works with existing JSX components unchanged. Simplifying the build now prevents carrying complexity forward.

### Tasks

#### 1.1 Replace React with Preact
```bash
npm uninstall react react-dom
npm install preact
```

#### 1.2 Configure esbuild aliases
In `esbuild.config.mjs`, add aliases so existing imports work:
```javascript
alias: {
  'react': 'preact/compat',
  'react-dom': 'preact/compat',
  'react/jsx-runtime': 'preact/jsx-runtime'
}
```

#### 1.3 Update tsconfig.json
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

#### 1.4 Simplify CSS handling
Remove custom CSS plugin from esbuild. Use esbuild's native CSS bundling:
```javascript
// esbuild will automatically bundle imported .css files
entryPoints: ['src/main.ts'],
bundle: true,
// CSS imports in TS files are concatenated into styles.css
```

#### 1.5 Create context providers
**Files**: `src/context/PluginContext.tsx`, `src/context/ReviewContext.tsx`

```typescript
// PluginContext.tsx
export const PluginContext = createContext<{ app: App; plugin: Plugin } | null>(null);
export function useApp(): App { ... }
export function usePlugin(): Plugin { ... }

// ReviewContext.tsx
export const ReviewContext = createContext<ReviewContextValue | null>(null);
export function useReviewState(): ReviewState { ... }
export function useReviewActions(): ReviewActions { ... }
export function useCurrentCard(): TFile | null { ... }
```

#### 1.6 Verify existing components
- Run build, check for errors
- Open review view, confirm rendering works
- Test keyboard shortcuts (1-4, Enter, Space)

### Deliverables
- [ ] Preact installed and aliased
- [ ] Build produces working `main.js` + `styles.css`
- [ ] Bundle size reduced
- [ ] All existing functionality preserved
- [ ] Context providers created (`PluginContext`, `ReviewContext`)
- [ ] Hooks available (`useApp`, `usePlugin`, `useReviewState`, `useReviewActions`)

---

## Phase 2: FSRS Integration + Data Model

### Rationale
FSRS (Free Spaced Repetition Scheduler) is a modern, research-backed algorithm with better retention predictions than SM-2. The `ts-fsrs` library provides a clean TypeScript API.

### Dependencies
```bash
npm install ts-fsrs
```

### FSRS Card State
Each card uses flat frontmatter properties (see Architecture Decisions above for full schema).

Key fields for FSRS:
- `due`: Next review datetime
- `status`: Maps to FSRS State (new=0, learning=1, review=2, relearning=3)
- `stability`: FSRS memory stability
- `difficulty`: FSRS difficulty (0-10)
- `reps`: Successful repetitions count
- `lapses`: Times forgotten count
- `last_review`: Timestamp of last review

### Tasks

#### 2.1 Create scheduling module
**File**: `src/scheduling/fsrs.ts`

Uses the unified `CardState` interface from Architecture section. Key FSRS functions:
```typescript
import { FSRS, Card, Rating, createEmptyCard, generatorParameters } from 'ts-fsrs';
import { CardState, Status } from './types';

// CardState is defined in src/scheduling/types.ts matching Architecture section

export function createScheduler(): FSRS {
  const params = generatorParameters({
    maximum_interval: 365,  // Max 1 year between reviews
  });
  return new FSRS(params);
}

export function createNewCard(): CardState {
  const card = createEmptyCard();
  return cardToState(card);
}

export function gradeCard(
  scheduler: FSRS,
  state: CardState,
  rating: Rating,
  now: Date = new Date()
): CardState {
  const card = stateToCard(state);
  const result = scheduler.repeat(card, now);
  return cardToState(result[rating].card);
}

// Conversion helpers between ts-fsrs Card and our CardState
function cardToState(card: Card): CardState { ... }
function stateToCard(state: CardState): Card { ... }
```

#### 2.2 Create frontmatter helpers
**File**: `src/scheduling/frontmatter.ts`
```typescript
import { App, TFile } from 'obsidian';
import { CardState } from './fsrs';

export async function readCardState(app: App, file: TFile): Promise<CardState | null> {
  // Parse frontmatter flat properties (due, status, type, priority, etc.)
  // Return null if not an extract (missing #extract tag)
}

export async function writeCardState(
  app: App,
  file: TFile,
  state: CardState
): Promise<void> {
  // Read file, parse frontmatter, update fsrs block, write back
}

export async function initializeCardState(
  app: App,
  file: TFile
): Promise<void> {
  // Add default fsrs block to existing extract
}
```

#### 2.3 Update extract command
Modify `src/commands/extract.ts` to include full CardState with flat properties:
```typescript
const now = moment();
const frontmatter = `---
source: "[[${sourcePath}]]"
tags: [extract]
type: topic
created: ${now.format('YYYY-MM-DDTHH:mm:ss')}
due: ${now.format('YYYY-MM-DDTHH:mm:ss')}
status: new
priority: 50
stability: 0
difficulty: 0
reps: 0
lapses: 0
last_review:
scroll_pos: 0
---`;
```

#### 2.4 Update cloze command
When cloze is applied to an existing extract, update its type:
```typescript
// If file has #extract tag and type !== 'item', change to item
async function convertToItem(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (fm.tags?.includes('extract') && fm.type !== 'item') {
      fm.type = 'item';
    }
  });
}
```

#### 2.5 Migration utility
Create command to migrate existing extracts:
```typescript
// Add fsrs block to all notes with #extract tag that don't have it
async function migrateExistingExtracts(app: App): Promise<number> {
  const extracts = getNotesWithTag(app, '#extract');
  let migrated = 0;
  for (const file of extracts) {
    if (!await hasCardState(app, file)) {
      await initializeCardState(app, file);
      migrated++;
    }
  }
  return migrated;
}
```

### Deliverables
- [ ] `ts-fsrs` installed
- [ ] `src/scheduling/fsrs.ts` - scheduler wrapper
- [ ] `src/scheduling/frontmatter.ts` - YAML read/write
- [ ] Extract command creates cards with FSRS state
- [ ] Migration command for existing extracts
- [ ] `src/bases/` module creates IR/ folder with .base files on load

---

## Phase 3: Priority Queue Implementation

### Rationale
The review queue should prioritize due cards and respect the FSRS scheduling. New cards should be introduced at a configurable rate.

### Queue Logic
```typescript
interface ReviewQueue {
  learning: Array<{ file: TFile; state: CardState }>;  // Learning/Relearning, due now
  due: Array<{ file: TFile; state: CardState }>;       // Review cards due
  new: Array<{ file: TFile; state: CardState }>;       // New cards
}

async function buildQueue(app: App, now: Date): Promise<ReviewQueue> {
  const extracts = getNotesWithTag(app, '#extract');
  const queue: ReviewQueue = { learning: [], due: [], new: [] };

  for (const file of extracts) {
    const state = await readCardState(app, file);
    if (!state) continue;

    const entry = { file, state };

    switch (state.status) {
      case 'new':
        queue.new.push(entry);
        break;
      case 'learning':
      case 'relearning':
        if (state.due <= now) queue.learning.push(entry);
        break;
      case 'review':
        if (state.due <= now) queue.due.push(entry);
        break;
    }
  }

  // Sort learning by due (soonest first)
  queue.learning.sort((a, b) => a.state.due.getTime() - b.state.due.getTime());

  // Sort due by priority (lower = higher priority), then due date
  queue.due.sort((a, b) =>
    a.state.priority - b.state.priority ||
    a.state.due.getTime() - b.state.due.getTime()
  );

  // Sort new by priority, then created date
  queue.new.sort((a, b) =>
    a.state.priority - b.state.priority ||
    a.state.created.getTime() - b.state.created.getTime()
  );

  return queue;
}

function getNextCard(queue: ReviewQueue): { file: TFile; state: CardState } | null {
  // Priority: learning > due > new
  return queue.learning[0] ?? queue.due[0] ?? queue.new[0] ?? null;
}
```

### Tasks

#### 3.1 Create queue module
**File**: `src/scheduling/queue.ts`
- `buildQueue(app, now)` - builds prioritized queue
- `getNextCard(queue, settings)` - returns next card respecting new card limit
- `getQueueStats(queue)` - returns counts for UI

#### 3.2 Update ReviewItemView
Modify `src/views/review/ReviewItemView.tsx`:
```typescript
private async onGradeAsync(rating: number): Promise<void> {
  const file = this.getCurrentCard();
  // ... check file ...
  const state = await readCardState(this.appRef, file);

  let newState: CardState;

  if (state.type === 'topic') {
    // Topic Logic: Reschedule
    // Rating 1: Next (soon)
    // Rating 2: Later (default interval)
    // Rating 3: Done (dismiss)
    // Save scroll position!
    const cursor = this.getEditorCursor(); // Helper to get offset
    newState = {
      ...state,
      scroll_pos: cursor,
      due: calculateTopicInterval(state, rating), // Simple algo or FSRS
      last_review: new Date()
    };
  } else {
    // Item Logic: FSRS
    const fsrsRating = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy][rating - 1];
    const fsrsResult = gradeCard(this.scheduler, state, fsrsRating);
    newState = { ...state, ...fsrsResult };
  }

  // Persist
  await writeCardState(this.appRef, file, newState);

  // Advance
  this.advanceCard();
}
```

#### 3.3 Implement advanceCard properly
// ... existing code ...

### Deliverables
- [ ] `src/scheduling/queue.ts` - queue building and management
- [ ] Grading persists FSRS state to frontmatter
- [ ] Queue respects due dates
- [ ] Cards disappear from queue after grading (until next due)

---

## Phase 4: Review Screen Polish

### Tasks

#### 4.1 Queue statistics display
Show in review header:
```
Due: 12 | New: 5 | Done today: 8
```

#### 4.2 Session tracking
Track cards reviewed in current session:
```typescript
interface SessionStats {
  started: Date;
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}
```

#### 4.3 Empty state
When queue is empty:
```
Congratulations!
No more cards due for review.
Next review: Tomorrow at 9:00 AM (12 cards)
```

#### 4.4 Cloze reveal interaction
// ... existing code ...

#### 4.5 Read Point Persistence (Cursor Tracking)
Automatically save and restore reading position for Topics.
- **On Open**: If `type === 'topic'`, read `scroll_pos` from frontmatter and scroll editor to that offset.
- **On Pause/Exit**: When navigating away or hitting "Next", save current cursor offset to `scroll_pos`.
- **Implementation**: Use Obsidian's `editor.getCursor()` (converted to offset) and `editor.setCursor()`.

#### 4.6 Breadcrumb Navigation
Show source chain in review header for context recovery:
```
📄 Original Article > 📑 Section 2 > 📝 Current Card
```
- Clickable links to open parent notes
- Uses `getBreadcrumbs()` helper from Architecture section
- Helps user remember "where am I in this material?"

### Deliverables
- [ ] Queue stats in header
- [ ] Session statistics
- [ ] Empty state with next review info
- [ ] Click-to-reveal clozes
- [ ] Read-point (scroll position) saving and restoration
- [ ] Breadcrumb navigation showing source chain

---

## Phase 5: Cloze Enhancements

### Tasks

#### 5.1 Auto-increment cloze index
Track highest cloze index in current note:
```typescript
function getNextClozeIndex(content: string): number {
  const matches = content.matchAll(/\{\{c(\d+)::/g);
  let max = 0;
  for (const match of matches) {
    max = Math.max(max, parseInt(match[1]));
  }
  return max + 1;
}
```

#### 5.2 Cloze-specific review mode
Option to review cards one cloze at a time:
- Show card with all clozes hidden
- Reveal clozes sequentially
- Grade based on recall of each cloze

#### 5.3 Cloze deletion command improvements
- `Cmd/Ctrl+Shift+C`: Create cloze with next index
- `Cmd/Ctrl+Shift+Alt+C`: Create cloze with same index (for related content)

### Deliverables
- [ ] Auto-incrementing cloze indices
- [ ] Keyboard shortcuts for cloze creation
- [ ] Per-cloze review mode (optional)

---

## Phase 6: Settings & Configuration

### Settings Interface
```typescript
interface PluginSettings {
  // Queue
  newCardsPerDay: number;        // Default: 20
  reviewOrder: 'due-first' | 'new-first' | 'mixed';

  // Scheduling
  maximumInterval: number;       // Default: 365 days
  requestRetention: number;      // Default: 0.9 (90%)

  // Extract
  extractTitleWords: number;     // Default: 5
  extractTag: string;            // Default: 'extract'

  // Review
  showNextReviewTime: boolean;   // Show interval on grade buttons
  autoAdvanceDelay: number;      // ms to wait before next card (0 = instant)
}
```

### Tasks
- [ ] Create settings tab
- [ ] Wire settings to scheduler
- [ ] Persist settings

---

## File Structure (Final)

```
src/
├── main.ts                      # Plugin entry, command registration
├── settings.ts                  # Settings tab and defaults
├── bases/
│   ├── index.ts
│   ├── setup.ts                 # Create IR/ folder and .base files
│   └── definitions.ts           # YAML content for each .base file
├── commands/
│   ├── index.ts
│   ├── extract.ts               # Extract to incremental note
│   └── cloze.ts                 # Cloze deletion
├── context/
│   ├── index.ts
│   ├── PluginContext.tsx        # App/Plugin context and hooks
│   └── ReviewContext.tsx        # Review state context and hooks
├── scheduling/
│   ├── index.ts
│   ├── fsrs.ts                  # FSRS wrapper
│   ├── frontmatter.ts           # Card state persistence
│   └── queue.ts                 # Priority queue logic
├── views/
│   └── review/
│       ├── index.ts
│       ├── ReviewItemView.tsx   # View controller
│       ├── ReviewView.tsx       # Main UI component
│       ├── GradeBar.tsx         # Grade buttons
│       ├── MarkdownBlock.tsx    # Content renderer
│       ├── QueueStats.tsx       # Header stats
│       └── reviewView.css
└── utils/
    ├── search.ts                # Tag-based note search
    └── markdown.ts              # Markdown rendering
```

**Vault structure** (created by plugin):
```
IR/
├── Due Today.base
├── Topics.base
├── Items.base
├── New Cards.base
├── Learning.base
├── All Extracts.base
└── By Source.base
```

---

## Implementation Order

1. **Phase 1**: Build simplification (foundation)
2. **Phase 2**: FSRS + data model (core scheduling)
3. **Phase 3**: Priority queue (makes review useful)
4. **Phase 4**: UI polish (user experience)
5. **Phase 5**: Cloze enhancements (power features)
6. **Phase 6**: Settings (customization)

Each phase is independently deployable. After Phase 3, the plugin is functionally complete for basic incremental reading.

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Extract creates note with valid FSRS frontmatter
- [ ] Review view loads due cards in correct order
- [ ] Grading updates frontmatter and reschedules
- [ ] Card disappears from queue after grading
- [ ] Card reappears when due
- [ ] Clozes render and reveal correctly
- [ ] Keyboard shortcuts work in review
- [ ] Settings persist across restarts

### Edge Cases
- Empty queue handling
- Corrupted frontmatter recovery
- Very large queues (1000+ cards)
- Rapid grading (debouncing)
- File rename/move during review
