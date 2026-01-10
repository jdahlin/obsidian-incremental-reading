# Architecture

Technical architecture for the Incremental Reading plugin.

---

## Design Principles

### 1. Notes are Canonical

Markdown notes are the source of truth for content. Users can edit, move, rename, or delete notes freely. The plugin adapts.

### 2. Sidecar Files for Review State

Review state lives in Markdown sidecar files for readability and debugging:

- Per-cloze scheduling (since a note can have N clozes)
- Review history (append-only JSONL log)

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

### 4. Engine Independence

The core review engine (`src/engine/`) has no Obsidian dependencies. It can run:

- In Obsidian (via adapters)
- In a CLI (via `src/engine/cli/`)
- In tests (via in-memory stores)

---

## Data Model

### Entities

```
Note (Markdown file)
├── Frontmatter (YAML)
│   ├── tags: [topic]
│   ├── source: "[[Parent]]"
│   ├── ir_note_id: string
│   ├── created: Date
│   └── priority: 0-100
│
├── Content (Markdown)
│   └── May contain clozes: {{c1::text}}, {{c2::text}}
│
└── Derived → ReviewItem(s)
```

```
ReviewItem (what gets reviewed)
├── id: string              # "ir_note_id" for topics, "ir_note_id::cN" for clozes
├── noteId: string          # Reference to the note
├── notePath: string        # File path
├── type: 'topic' | 'cloze'
├── clozeIndex: number?     # null for topics, 1/2/3/... for clozes
├── priority: number        # 0-100, inherited from note
└── created: Date?
```

```
ReviewState (scheduling)
├── status: 'new' | 'learning' | 'review' | 'relearning'
├── due: Date | null
├── stability: number       # FSRS: memory strength in days
├── difficulty: number      # FSRS: 0-10
├── reps: number            # Total reviews
├── lapses: number          # Times forgotten
└── lastReview: Date | null
```

### Identifiers

- `ir_note_id`: NanoID length 12
- `cloze_uid`: NanoID length 12
- Full item ID: `ir_note_id` (topics) or `ir_note_id::cN` (clozes)

### Notes vs Items

A **Note** is a file. A **ReviewItem** is something you review.

| Note Type          | Creates ReviewItems                 |
| ------------------ | ----------------------------------- |
| Topic (no clozes)  | 1 topic item                        |
| Note with N clozes | N cloze items (one per cloze index) |

### Folders as Decks

Folders = Decks. No explicit deck property needed - folder path IS the deck.

```
Biochemistry/                    # Course
├── Krebs Cycle/                 # Lecture (Deck)
│   ├── ATP yield.md             # Note with clozes
│   └── Acetyl-CoA.md
└── Glycolysis/                  # Another deck
    └── Net ATP.md
```

---

## Module Structure

```
src/
├── core/                    # Pure utilities (no Obsidian deps)
│   ├── types.ts             # Core type definitions
│   ├── cloze.ts             # Cloze parsing/formatting
│   ├── dates.ts             # Date utilities
│   ├── decks.ts             # Deck hierarchy utilities
│   └── frontmatter.ts       # YAML parsing/serialization
│
├── engine/                  # Review engine (platform-agnostic)
│   ├── types.ts             # Engine interfaces
│   ├── SessionManager.ts    # Core session logic
│   │
│   ├── strategies/          # Queue ordering strategies
│   │   ├── JD1Strategy.ts   # Priority-urgency (default)
│   │   ├── AnkiStrategy.ts  # Simple due-date ordering
│   │   └── types.ts
│   │
│   ├── scheduling/          # Spaced repetition algorithms
│   │   ├── FSRSScheduler.ts # FSRS algorithm (primary)
│   │   ├── SM2Scheduler.ts  # SuperMemo-2 (stub)
│   │   └── TopicScheduler.ts # Simpler intervals for topics
│   │
│   ├── data/                # Data store implementations
│   │   ├── FileSystem.ts    # File system interface
│   │   └── MarkdownDataStore.ts # Sidecar file storage
│   │
│   ├── memory/              # In-memory store (testing)
│   │   └── MemoryDataStore.ts
│   │
│   ├── adapters/            # Platform adapters
│   │   ├── ObsidianVault.ts
│   │   ├── ObsidianNotePlatform.ts
│   │   └── EngineReviewController.ts
│   │
│   ├── rv/                  # .rv script DSL (testing)
│   │   ├── parser.ts
│   │   └── runner.ts
│   │
│   ├── anki/                # Anki import/export
│   │   ├── converter.ts
│   │   ├── reader.ts
│   │   └── html.ts
│   │
│   └── cli/                 # Standalone CLI
│       ├── index.tsx
│       └── screens/
│
├── data/                    # Obsidian data layer
│   ├── review-items.ts      # Sidecar read/write
│   ├── revlog.ts            # JSONL review log
│   ├── sync.ts              # Note ↔ sidecar sync
│   ├── ids.ts               # NanoID generation
│   └── export.ts            # Data export
│
├── commands/                # Obsidian commands
│   ├── extract.ts           # Extract selection to new note
│   ├── cloze.ts             # Create cloze deletion
│   └── index.ts             # Command registration
│
├── editor/                  # Editor extensions
│   └── cloze-hider.ts       # Hide cloze answers during review
│
├── ui/                      # Preact UI components
│   ├── review/              # Review view
│   │   ├── ReviewItemView.tsx
│   │   ├── ReviewRoot.tsx
│   │   ├── DeckSummary.tsx
│   │   ├── ReviewQuestionScreen.tsx
│   │   ├── ReviewAnswerScreen.tsx
│   │   └── ...
│   ├── stats/               # Statistics modal
│   │   └── StatsModal.ts
│   └── PriorityModal.ts
│
├── stats/                   # Statistics (pure functions)
│   └── aggregations.ts
│
├── bases/                   # Obsidian Bases integration
│   └── index.ts
│
├── settings.ts              # Plugin settings
└── main.ts                  # Plugin entry point
```

---

## Engine Architecture

The engine is designed for independence from Obsidian, enabling CLI usage and comprehensive testing.

### Core Abstractions

```typescript
// SessionManager: orchestrates review sessions
class SessionManager {
	constructor(dataStore: DataStore, notePlatform: NotePlatform, config: SessionConfig);
	loadPool(now: Date): Promise<void>;
	getNext(now: Date): Promise<SessionItem | null>;
	recordReview(itemId: string, rating: Rating, now: Date): Promise<void>;
}

// DataStore: persistence interface
interface DataStore {
	listItems(): Promise<ReviewItem[]>;
	getState(itemId: string): Promise<ReviewState | null>;
	setState(itemId: string, state: ReviewState): Promise<void>;
	appendReview(record: ReviewRecord): Promise<void>;
}

// NotePlatform: content access
interface NotePlatform {
	getNote(noteId: string): Promise<string | null>;
	setNote(noteId: string, content: string): Promise<void>;
	getLinks(noteId: string): Promise<string[]>;
}

// Scheduler: memory math
interface Scheduler {
	grade(state: ReviewState, rating: Rating, now: Date): ReviewState;
	isDue(state: ReviewState, now: Date): boolean;
}
```

### Session Strategies

Two strategies control queue ordering:

#### JD1 (Default)

Priority-urgency ranking for knowledge synthesis.

```
Score = (Priority * 100) + TypeWeight + LinkedAffinity + UrgencyTerm + RecencyTerm

TypeWeight    = Topic ? 50 : 0
LinkedAffinity = linked to previous item ? 30 : 0
UrgencyTerm   = (1 - R) * 25, where R = exp(-daysSinceReview / stability)
RecencyTerm   = min(10, floor(daysSinceReview / 7))
```

Rules:

- Priority bands dominate ordering
- LinkedAffinity boosts items linked to previously reviewed item
- Probabilistic interleaving: 80% top band, 20% lower bands
- Clump limit: max 3 clozes per note in a row (configurable)
- Again cooldown: 5 items must pass before re-selection (configurable)

#### Anki

Simple due-date ordering for migration compatibility.

- Bucket order: Learning → Due → New
- Sort by due date within buckets
- Short requeue on Again

### Schedulers

| Scheduler | Purpose                                | Status         |
| --------- | -------------------------------------- | -------------- |
| FSRS      | Primary algorithm for clozes           | ✅ Implemented |
| SM2       | SuperMemo-2 alternative                | Stub           |
| Topic     | Simpler intervals for reading material | ✅ Implemented |

Topic scheduler intervals:

- Grade 1 (Again): +10 minutes
- Grade 2 (Hard): +1 day
- Grade 3 (Good): +3 days
- Grade 4 (Easy): +7 days

### Exam Mode

When `examDate` is set, intervals are compressed:

```
daysToExam = max(0, (examDate - now) / day)
targetInterval = clamp(daysToExam / 6, 1, 60)
due = min(schedulerDue, now + targetInterval)
```

---

## Storage

### File Locations

| Data          | Location                          | Format           |
| ------------- | --------------------------------- | ---------------- |
| Review items  | `IR/Review Items/<ir_note_id>.md` | YAML frontmatter |
| Review log    | `IR/Revlog/YYYY-MM.md`            | JSONL            |
| Note metadata | Note frontmatter                  | YAML             |

### Sidecar File Format

Path: `IR/Review Items/<ir_note_id>.md`

```yaml
---
ir_note_id: Ab3Kp9Xr2QaL
note_path: Biochemistry/Krebs Cycle/ATP.md
topic:
    status: review
    due: 2024-01-20T10:00:00
    stability: 15.2
    difficulty: 5.5
    reps: 8
    lapses: 1
    last_review: 2024-01-18T14:00:00
clozes:
    c1:
        cloze_uid: G7uT2mQ9rW1z
        status: review
        due: 2024-01-20T10:00:00
        stability: 15.2
        difficulty: 5.5
        reps: 8
        lapses: 1
        last_review: 2024-01-18T14:00:00
    c2:
        cloze_uid: p8Ls2ZQv6N4k
        status: new
---
```

### Review Log Format

Path: `IR/Revlog/YYYY-MM.md`

JSONL format, one object per line:

```json
{
	"ts": "2024-01-15T10:30:00.000Z",
	"item_id": "Ab3Kp9Xr2QaL::c1",
	"rating": 3,
	"state_before": "review",
	"stability_before": 15.2,
	"difficulty_before": 5.5
}
```

### Note Frontmatter

Minimal frontmatter in notes (only non-default values):

```yaml
---
tags: [topic]
ir_note_id: Ab3Kp9Xr2QaL
source: '[[Parent Note]]'
created: 2024-01-15T10:30:00
priority: 20 # Only if not default (50)
scroll_pos: 450 # Topics only, if scrolled
---
```

---

## Review UI Flow

```
Open Review (Cmd+Shift+R)
         │
         ▼
┌─────────────────┐
│  Deck Summary   │◄────────────┐
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
│  Question phase │
│  [Show Answer]  │
│      ↓          │
│  Answer phase   │
│  [1] [2] [3] [4]│
└─────────────────┘
         │
         │ Queue empty
         ▼
┌─────────────────┐
│  Session Done   │
│  Stats summary  │
│  [Back to Deck] │
└─────────────────┘
```

Notes remain editable during review (core IR principle).

---

## Testing

### .rv Script DSL

The engine is validated via `.rv` scripts - a domain-specific language for testing review scenarios:

```
# Create a topic and cloze
topic "The mitochondria is the powerhouse of the cell" --priority 80
cloze T-1 4 16

# Start session and review
session JD1
clock 2024-01-15
grade T-1::c1 3

# Assertions
expect notes.T-1.priority 80
expect grades[0].rating 3
```

Commands:

- `topic`, `extract`, `cloze` - Content creation
- `session`, `scheduler`, `clock` - Configuration
- `grade`, `again`, `postpone` - Review actions
- `expect` - Assertions
- `inspect-next`, `status` - Debugging

### Test Structure

Tests are colocated with modules in `tests/` directories:

```
src/engine/
├── SessionManager.ts
└── tests/
    ├── SessionManager.test.ts
    ├── rv-runner.test.ts
    └── rv-runner-markdown.test.ts
```

---

## Settings

| Setting            | Default | Description                           |
| ------------------ | ------- | ------------------------------------- |
| `newCardsPerDay`   | 10      | Max new items per day                 |
| `maximumInterval`  | 365     | Upper bound for intervals             |
| `requestRetention` | 0.9     | Target retention rate                 |
| `extractTag`       | 'topic' | Tag for review notes                  |
| `queueStrategy`    | 'JD1'   | Queue ordering (JD1 or Anki)          |
| `clumpLimit`       | 3       | Max consecutive clozes from same note |
| `cooldown`         | 5       | Reviews before failed item re-enters  |

---

## Race Condition Handling

All file operations use try/catch for concurrent access:

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

---

## Dependencies

| Package        | Purpose         | Notes    |
| -------------- | --------------- | -------- |
| ts-fsrs        | FSRS scheduling | ~15KB    |
| preact         | UI components   | ~4KB     |
| js-yaml        | YAML parsing    | Fast     |
| better-sqlite3 | Anki import     | CLI only |
