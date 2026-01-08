# Implementation Specification

This document provides a step-by-step implementation guide. Each phase builds on the previous.

**Related Documents:**

- `USER_GUIDE.md` - What the plugin does (user perspective)
- `ARCHITECTURE.md` - Technical design and data model

---

## Current Implementation Summary

### What's Working

| Feature                  | Status  | Notes                                              |
| ------------------------ | ------- | -------------------------------------------------- |
| Cloze creation           | ✅ Done | Plain `{{c1::text}}` syntax                        |
| Cloze display (question) | ✅ Done | Content shows `[...]` placeholder                  |
| Cloze display (answer)   | ✅ Done | Full text revealed                                 |
| Review grading           | ✅ Done | 1-4 buttons, color-coded                           |
| Deck summary screen      | ✅ Done | Two-screen flow (Deck List → Review)               |
| Per-cloze scheduling     | ✅ Done | Via sidecar files                                  |
| Single-pane review       | ✅ Done | Content rendered in review panel                   |
| Topic vs cloze handling  | ✅ Done | Topics show grade buttons immediately              |
| Session stats            | ✅ Done | Completion screen shows reviewed + grade breakdown |
| JSONL revlog             | ✅ Done | `IR/Revlog/YYYY-MM.md`                             |
| Sidecar storage          | ✅ Done | `IR/Review Items/<id>.md`                          |
| Keyboard shortcuts       | ✅ Done | Enter/Space = show, 1-4 = grade, Esc = back        |

### What's Missing (Gaps)

| Feature              | Gap             | Priority |
| -------------------- | --------------- | -------- |
| Priority editing     | No UI yet       | Medium   |
| Dismiss/delete items | Not implemented | Medium   |
| Statistics modal     | Basic only      | Low      |
| Bases integration    | Not started     | Low      |
| Image occlusion      | Not started     | Future   |

### Key Implementation Decisions

1. **Cloze syntax**: Plain Anki-style `{{c1::text}}` (no HTML wrapper)
2. **Single-pane review**: Content rendered directly in review panel (no separate editor tab)
3. **Topic review**: Topics (extracts without cloze) skip "Show Answer" and show grade buttons immediately
4. **Cloze review**: Shows question with `[...]` → "Show Answer" → grade buttons
5. **Race condition handling**: try/catch on file create with fallback to append

### Source Files Reference

| File                                  | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `src/data/revlog.ts`                  | JSONL revlog with race condition handling                  |
| `src/data/review-items.ts`            | Sidecar file read/write                                    |
| `src/data/sync.ts`                    | Note ↔ sidecar synchronization                             |
| `src/core/types.ts`                   | Type definitions                                           |
| `src/core/cloze.ts`                   | Cloze parsing (`formatClozeQuestion`, `formatClozeAnswer`) |
| `src/views/review/ReviewItemView.tsx` | Review view controller                                     |
| `src/views/review/ReviewScreen.tsx`   | Review UI component                                        |
| `src/views/review/DeckSummary.tsx`    | Deck list UI                                               |
| `src/commands/cloze.ts`               | Cloze creation command                                     |
| `src/commands/extract.ts`             | Extract command                                            |

### Race Condition Pattern

All file/folder creation uses this pattern:

```typescript
try {
	await app.vault.create(path, content);
} catch {
	const file = app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		await app.vault.append(file, content);
	}
}
```

Applied in: `src/data/revlog.ts`, `src/data/review-items.ts`

---

## Phase 1: Core Types & Pure Functions

**Goal:** Establish testable foundation with no Obsidian dependencies.

### 1.1 Create Type Definitions

File: `src/core/types.ts`

Define all core types:

- `Status`: 'new' | 'learning' | 'review' | 'relearning'
- `CardType`: 'topic' | 'item'
- `ItemState`: Scheduling state (due, stability, difficulty, reps, lapses, last_review)
- `ReviewItem`: What gets reviewed (id, noteFile, type, clozeIndex, state, priority)
- `ReviewQueue`: Categorized items (learning, due, new, upcoming)
- `NoteFrontmatter`: Parsed frontmatter data (includes `ir_note_id`)
- `ReviewRecord`: Single review log entry (`item_id`, `rating`, `ts`, etc.)

### 1.2 Date Utilities

File: `src/core/dates.ts`

Implement:

- `addDays(date, days)` -> Date
- `addMinutes(date, minutes)` -> Date
- `isToday(date, now)` -> boolean
- `startOfDay(date)` -> Date
- `daysBetween(a, b)` -> number

All functions are pure. No side effects.

### 1.3 Frontmatter Utilities

File: `src/core/frontmatter.ts`

Implement:

- `normalizeTags(tags)` -> string[]
- `normalizeType(value)` -> CardType
- `normalizeStatus(value)` -> Status
- `normalizeNumber(value, fallback)` -> number
- `parseDate(value)` -> Date | null
- `formatDate(date)` -> string
- `parseFrontmatter(raw, extractTag)` -> NoteFrontmatter | null
- `serializeFrontmatter(fm)` -> Record<string, unknown>

### 1.4 Cloze Utilities

File: `src/core/cloze.ts`

Implement:

- `parseClozeIndices(content)` -> number[]
- `getNextClozeIndex(content)` -> number
- `getHighestClozeIndex(content)` -> number | null
- `formatClozeQuestion(content, clozeIndex)` -> string
- `formatClozeAnswer(content, clozeIndex)` -> string
- `escapeHtmlText(text)` -> string

### 1.5 Scheduling Logic

File: `src/core/scheduling.ts`

Implement:

- `mapGradeToRating(grade)` -> Rating
- `gradeTopic(state, grade, now)` -> ItemState
- `gradeItem(state, rating, now, fsrsParams)` -> ItemState
- `calculateBurden(items)` -> number

Topic grading intervals:

- Grade 1: +10 minutes, status=learning
- Grade 2: +1 day, status=review
- Grade 3: +3 days, status=review
- Grade 4: +7 days, status=review

### 1.6 Queue Logic

File: `src/core/queue.ts`

Implement:

- `filterByFolder(items, folderPath?)` -> ReviewItem[]
- `categorizeItems(items, now)` -> { learning, due, new, upcoming }
- `sortByPriority(items, tiebreaker)` -> ReviewItem[]
- `buildQueue(items, now, options)` -> ReviewQueue
    - options: `{ newCardsLimit, folderFilter? }`
- `getNextItem(queue)` -> ReviewItem | null
- `getQueueStats(queue)` -> { learning, due, new, total }

Priority: learning (by due) > due (by priority, due) > new (by priority, created)

### 1.7 Tests (Deferred)

Testing is deferred until core features are working end-to-end.

**Deliverables Phase 1:**

- [ ] All types defined
- [ ] All pure functions implemented

---

## Phase 2: Markdown Storage Layer

**Goal:** Persistent, readable storage for item scheduling and review history.

### 2.1 ID Utilities

File: `src/data/ids.ts`

Implement NanoID:

- Length: 12
- Alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`
- `createId()` -> string

### 2.2 Sidecar Storage (Review Items)

File: `src/data/review-items.ts`

Paths:

- `IR/Review Items/<ir_note_id>.md`

Implement:

- `ensureNoteId(file)` -> string (writes `ir_note_id` if missing)
- `readReviewItemFile(noteId)` -> ReviewItemFile
- `writeReviewItemFile(noteId, data)` -> void
- `updateClozeState(noteId, clozeIndex, state)` -> void
- `updateTopicState(noteId, state)` -> void
- `deleteReviewItemFile(noteId)` -> void
- `updateReviewItemNotePath(noteId, notePath)` -> void

Sidecar schema (example):

```yaml
---
ir_note_id: Ab3Kp9Xr2QaL
note_path: Biochemistry/Krebs Cycle/ATP.md
topic:
    status: review
    due: 2024-01-20T10:00:00
    reps: 3
    lapses: 0
    last_review: 2024-01-18T14:00:00
clozes:
    c1:
        cloze_uid: G7uT2mQ9rW1z
        status: learning
        due: 2024-01-15T10:40:00
        stability: 2.1
        difficulty: 6.3
        reps: 1
        lapses: 0
        last_review: 2024-01-15T10:30:00
---
```

### 2.3 Revlog (Append-Only JSONL)

File: `src/data/revlog.ts`

Paths:

- `IR/Revlog/YYYY-MM.md`

Format: JSONL, one object per line (no frontmatter/header; file is valid Markdown but contains raw JSON lines).

Implement:

- `appendReview(entry)` -> void
- `readReviewsSince(date)` -> ReviewRecord[]
- `readReviewsForItem(itemId)` -> ReviewRecord[]
- `getReviewCount()` -> number

Recommended JSONL fields:

- `ts` (ISO string)
- `item_id` (`ir_note_id` for topics; `ir_note_id::cloze_uid` for items)
- `rating` (1-4)
- `elapsed_ms` (optional)
- `state_before` (status)
- `stability_before` / `difficulty_before` (items)

### 2.4 Sync Logic

File: `src/data/sync.ts`

Implement:

- `syncNoteToSidecar(app, file, extractTag)` -> void
    - Read note content and frontmatter
    - Parse cloze indices
    - Create/update sidecar entries
    - Remove stale cloze entries

- `syncAllNotes(app, extractTag)` -> void
    - Get all notes with tag
    - Sync each note
    - Remove orphaned sidecars (deleted notes)

**Deliverables Phase 2:**

- [ ] NanoID utilities work
- [ ] Sidecar read/write works
- [ ] Revlog append/read works
- [ ] Sync creates items from notes

---

## Phase 3: Review System

**Goal:** Complete review flow with two-screen design (Deck Summary → Review).

### 3.1 Review View Structure

The review view has two screens managed by a single `ReviewItemView`:

```
ReviewItemView (ItemView)
├── DeckSummary.tsx      # Screen 1: Deck selection + stats
└── ReviewScreen.tsx     # Screen 2: Card review
```

State: `screen: 'summary' | 'review'`

### 3.2 Deck Summary Screen

File: `src/views/review/DeckSummary.tsx`

Shows:

- Deck selector (folder dropdown with counts)
- Queue counts: New (blue) / Learning (orange) / Due (green)
- Today's stats from revlog
- Streak info
- Actions: Study Now, Browse, Statistics

Data loading:

1. Get preselected folder from active file
2. Read sidecar files for counts by status (filtered by folder)
3. Read revlog JSONL entries for today's reviews
4. Calculate streak from revlog

### 3.3 Review Screen

File: `src/views/review/ReviewScreen.tsx`

**Core principle**: Content is always editable (no mode switching).

Changes from current:

- `Esc` returns to Deck List (not closes view)
- Queue empty → show completion screen with "Back to Deck" button
- Notes remain editable in Obsidian's normal editor while reviewing
- Extract/Cloze commands always available (operate on the active editor)

**Two phases (for items only):**

```typescript
phase: 'question' | 'answer'; // Topics don't have phases
```

**Implementation:**

```typescript
// POC approach: open the note in a normal Markdown editor leaf (editable),
// and hide cloze answers in the editor itself while in the "question" phase.
//
// - The source note stays plain Markdown with clozes like {{c1::...}} (no HTML wrapper).
// - The plugin registers a CodeMirror editor extension that can visually hide cloze answers
//   for the active item (index cN), without modifying the file content.
// - Reveal switches the extension into "answer" mode (no hiding).
// - If the note content changes (user edits, adds/removes clozes), re-sync sidecar state.
await app.workspace.getLeaf(false).openFile(item.noteFile, { active: true });

const content = await vault.read(item.noteFile);
const indices = parseClozeIndices(content);
if (!indices.includes(item.clozeIndex)) {
	await syncNoteToSidecar(app, item.noteFile, extractTag);
}
```

**Cloze display approach (POC):**

- The note content remains unchanged (`{{cN::...}}`).
- The editor visually hides the answer text for the active cloze index while in question phase.
- Reveal on Space/Enter switches to answer phase (no hiding).
- For "same index" clozes, hide/reveal all `{{cN::...}}` occurrences in the note together.

### 3.5 Item Loading

Load items from sidecar files:

1. Read all sidecar entries (or filtered by folder)
2. Load priority from note frontmatter
3. Build queue using pure functions

### 3.6 Item Grading

When user grades:

1. Calculate new state (pure function)
2. Update sidecar state
3. Append to revlog JSONL
4. Advance to next item

### 3.7 Cloze Rendering (Editor Extension)

Implement a CodeMirror editor extension (via Obsidian's `registerEditorExtension`) to:

- Detect cloze patterns `{{cN::...}}` in the active editor document
- In question phase, hide only the answer portion for the active index `N` (or all occurrences for "same index")
- In answer phase, render clozes normally

### 3.8 Priority Modal

File: `src/ui/PriorityModal.ts`

When priority changes:

1. Update note frontmatter
2. Items inherit priority from note

### 3.9 Session Stats

Track in view:

- Reviews completed
- Ratings distribution
- Time elapsed

**Deliverables Phase 3:**

- [ ] Two-screen flow: Deck List → Review
- [ ] Deck List shows all folders with queue counts (New/Learning/Due)
- [ ] Deck List shows today's stats from revlog
- [ ] Deck preselection from active file's folder
- [ ] Review opens the note in an editable Markdown editor
- [ ] Cloze answers are hidden in the editor during question phase
- [ ] Content stays editable (no mode switching)
- [ ] Review header shows only deck/folder (no note title/breadcrumbs)
- [ ] Extract/Cloze commands work during review
- [ ] Auto-sync when clozes added/removed
- [ ] Grading updates sidecar + revlog
- [ ] Per-cloze scheduling works
- [ ] Notes remain reviewable as topics even after creating items
- [ ] Scroll position saved for topics
- [ ] Esc returns to Deck List
- [ ] Queue empty shows completion screen

---

## Phase 4: Commands

**Goal:** Extract and cloze creation.

### 4.1 Extract Command

File: `src/commands/extract.ts`

When extracting:

1. Create note with frontmatter (tags, source, created, priority)
2. Note starts as type=topic
3. Sync creates topic entry in sidecar

### 4.2 Cloze Commands

File: `src/commands/cloze.ts`

When creating cloze:

1. Insert plain cloze syntax (`{{cN::...}}`), no HTML wrapper
2. Update note type to 'item' if needed
3. Sync creates item entry in sidecar

Two commands:

- Next Index: `getNextClozeIndex` + 1
- Same Index: Reuse last or highest

**Deliverables Phase 4:**

- [ ] Extract creates note + sidecar entry
- [ ] Cloze creates item per cloze index
- [ ] Commands update sidecar correctly

---

## Phase 5: Statistics

**Goal:** Statistics modal with charts.

### 5.1 Statistics Aggregations

File: `src/stats/aggregations.ts`

Implement pure functions:

- `calculateRetention(reviews)` -> number
- `calculateStreak(reviewDates, today)` -> StreakInfo
- `calculateAnswerDistribution(reviews)` -> Distribution
- `buildHeatmapData(reviews, days)` -> HeatmapData[]
- `buildForecastData(items, days, now)` -> ForecastData[]

### 5.2 Statistics Modal

File: `src/views/stats/StatsModal.tsx`

Components:

- Today's Summary (text)
- Heatmap (Frappe Charts)
- Card States (pie chart)
- Forecast (bar chart)
- Retention (line chart)
- Answer Distribution (bar chart)

### 5.3 Frappe Charts Integration

Lazy load on modal open:

```ts
const { Chart } = await import('frappe-charts');
```

**Deliverables Phase 5:**

- [ ] Aggregations calculate correctly
- [ ] Modal displays all charts
- [ ] Streak tracking works

---

## Phase 6: Bases Integration

**Goal:** Bases views for browsing items.

### 6.1 Bases View Definition

Each `.base` file needs:

- Data source (how to query items)
- Column definitions
- Default filters

### 6.2 Per-Cloze Data in Sidecar Frontmatter

To make per-cloze data visible to Bases, store in sidecar frontmatter:

```yaml
clozes:
    c1:
        status: review
        due: 2024-01-20T10:00:00
        stability: 15.2
        difficulty: 5.5
    c2:
        status: new
        due: null
        stability: 0
        difficulty: 0
```

Update sidecar writer to write cloze data.

### 6.3 Create Default Views

On plugin load, ensure views exist:

**IR/All Items.base**

- Filter: `file.inFolder("IR/Review Items")`
- Columns: File, Type, Cloze, Status, Priority, Due, Stability, Difficulty, Reps, Lapses

**IR/Due Today.base**

- Filter: `file.inFolder("IR/Review Items")` AND due <= today AND status != new
- Columns: File, Type, Cloze, Priority, Due

**IR/Struggling.base**

- Filter: `file.inFolder("IR/Review Items")` AND lapses >= 3
- Columns: File, Type, Cloze, Lapses, Difficulty, Stability

**Deliverables Phase 6:**

- [ ] Cloze data written to sidecar frontmatter
- [ ] Bases views created
- [ ] Views show correct columns
- [ ] Filtering works

---

## Phase 7: Polish & Settings

**Goal:** Configuration and edge cases.

### 7.1 Settings

File: `src/settings.ts`

Add settings:

- `newCardsPerDay`: number (default 10)
- `maximumInterval`: number (default 365)
- `requestRetention`: number (default 0.9)
- `extractTag`: string (default 'topic')
- `extractTitleWords`: number (default 5)
- `trackReviewTime`: boolean (default true)
- `showStreak`: boolean (default true)

### 7.2 Migration

On first load with new architecture:

1. Read existing frontmatter-based scheduling
2. Create/update sidecar files under `IR/Review Items/`
3. Mark migration complete

### 7.3 Error Handling

- Sidecar load failure: Continue without review item, log warning
- Note read failure: Skip, log warning
- Sync failure: Retry, then warn user

### 7.4 Export

Add command: Export Review History

- Export revlog to CSV
- Include: timestamp, item_id, rating, elapsed_ms

**Deliverables Phase 7:**

- [ ] All settings work
- [ ] Migration preserves data
- [ ] Errors handled gracefully
- [ ] Export works

---

## Implementation Checklist

### Phase 1: Core

- [ ] types.ts
- [ ] dates.ts
- [ ] frontmatter.ts
- [ ] cloze.ts
- [ ] scheduling.ts
- [ ] queue.ts

### Phase 2: Markdown Storage

- [ ] ids.ts
- [ ] review-items.ts
- [ ] revlog.ts
- [ ] sync.ts

### Phase 3: Review

- [ ] ReviewItemView loads from sidecars
- [ ] Grading updates sidecar
- [ ] Per-cloze works
- [ ] Priority modal

### Phase 4: Commands

- [ ] Extract command
- [ ] Cloze next index
- [ ] Cloze same index

### Phase 5: Statistics

- [ ] aggregations.ts
- [ ] StatsModal.tsx
- [ ] Charts render

### Phase 6: Bases

- [ ] Cloze data in sidecar frontmatter
- [ ] View definitions
- [ ] Views created on load

### Phase 7: Polish

- [ ] Settings
- [ ] Migration
- [ ] Error handling
- [ ] Export

---

## File Structure (Final)

```
src/
├── core/                    # Pure functions (Phase 1)
│   ├── types.ts
│   ├── dates.ts
│   ├── frontmatter.ts
│   ├── cloze.ts
│   ├── scheduling.ts
│   └── queue.ts
│
├── data/                    # Markdown storage (Phase 2)
│   ├── ids.ts
│   ├── review-items.ts
│   ├── revlog.ts
│   └── sync.ts
│
├── stats/                   # Statistics (Phase 5)
│   └── aggregations.ts
│
├── commands/                # Commands (Phase 4)
│   ├── extract.ts
│   └── cloze.ts
│
├── views/                   # UI (Phase 3, 5)
│   ├── review/
│   │   ├── ReviewItemView.tsx
│   │   ├── ReviewView.tsx
│   │   ├── GradeBar.tsx
│   │   └── reviewView.css
│   └── stats/
│       ├── StatsModal.tsx
│       └── stats.css
│
├── editor/                  # Editor extensions (Phase 3)
│   └── cloze-hider.ts
│
├── ui/                      # Shared UI (Phase 3)
│   └── PriorityModal.ts
│
├── bases/                   # Bases integration (Phase 6)
│   └── definitions.ts
│
├── settings.ts              # Settings (Phase 7)
└── main.ts                  # Plugin entry

src/**/tests/               # Vitest suites colocated with modules
```
