# Fluid Engine Architecture (New Engine)

This spec defines a headless, platform-agnostic Incremental Reading engine validated via `.rv` scripts. It replaces the existing workflow and becomes the canonical logic layer. Initial validation uses in-memory storage only; file-backed stores come later.

---

## Goals

- Separate session experience from scheduling math.
- Allow JD1 (default) and Anki-style session ordering.
- Support FSRS now; SM2 later.
- Enable exam-date compression.
- Validate everything via .rv scripts (no JSONL fixtures).

---

## Core Abstractions

### 1. SessionManager (Logic Engine)

- Independence: no file, DOM, or Obsidian dependencies.
- Strategies: JD1 and Anki session ordering.
- Modes: Review (normal) and Exam (cloze-only drill).
- State: `pool`, `volatileQueue`, `current_index`, `scroll_pos`.

### 2. Scheduler (Memory Math)

- Scheduler abstraction with fsrs and sm2.
- Responsible only for due, stability, difficulty, and interval math.

### 3. DataStore (Persistence Interface)

- Stores all scheduling metadata; not embedded in ReviewItem.
- Implementations:
    - MemoryDataStore (primary for testing)
    - MarkdownDataStore (deferred)
    - SqliteDataStore (future)

### 4. NotePlatform (Content Interface)

- Access to notes + lightweight link graph.
- Implementations: Obsidian, Disk.

### 5. NoteManipulator (Pure Transforms)

- Extracts, cloze insertion, frontmatter updates.
- Pure string in/out.

---

## Session Strategies

### JD1 (Default)

Goal: Knowledge synthesis via context affinity and prioritized reading.

Scoring Formula:

```
Score = (Priority * 100) + TypeWeight + LinkedAffinity + UrgencyTerm + RecencyTerm
TypeWeight = Topic ? 50 : 0
UrgencyTerm = (1 - R) * 25
R = exp(-(days_since_review) / max(1, stability))
RecencyTerm = min(10, floor(days_since_review / 7))
```

Rules:

- Priority bands dominate ordering.
- LinkedAffinity boosts items linked to the previously reviewed item.
- Probabilistic interleaving: 80% top band, 20% lower bands.
- Clump limit: max 3 clozes per note in a row.
- Again cooldown: 5 items must pass before re-selection.

### Anki (Migration Mode)

- Bucket order: Learning -> Due -> New.
- Clozes before topics in each bucket.
- Short requeue on Again (step delay).

---

## Scheduler Selection

```
scheduler fsrs
scheduler sm2
```

- FSRS is implemented first.
- SM2 is a stub until implemented.

---

## Exam-Date Adjustment

When `session --exam YYYY-MM-DD` is set:

```
daysToExam = max(0, floor((examDate - now) / 86400000))
targetInterval = clamp(floor(daysToExam / targetReviews), minIntervalDays, maxIntervalDays)
due = min(schedulerDue, now + targetInterval days)
```

Defaults:

- targetReviews = 6
- minIntervalDays = 1
- maxIntervalDays = 60

---

## Batch DSL (.rv)

### File Rules

- Each line is a command.
- `#` starts a comment.
- No headers or metadata blocks.

### Commands (Detailed)

#### A. Ingestion & Growth

- `topic <content> [--title <str>] [--priority <n>]`
  Creates a source note and topic item.
- `extract <T-ID> <start> <end> [--priority <n>]`
  Creates a child extract note.
- `cloze <ID> <start> <end> [--hint <str>]`
  Inserts `{{cN::...}}` into the note.

#### B. Session Inspection

- `inspect-next [--limit <n>]`
  Outputs current session ordering (IDs + scores).
- `status`
  Outputs session progress, backlog size, and ratio stats.

#### C. Review Loop

- `show <ID> [--phase <question|answer>]`
  Renders content with cloze hiding (question) or reveal (answer).
- `grade <ID> <1-4>`
  Runs scheduler update + moves item to history.
- `again <ID>`
  Moves item into volatile queue with cooldown.

#### F. Assertions

- `expect <path> <value>`
  Fails the script if the value at `path` does not match the expected value.
    - Path format: `notes.note-1.id`, `grades[0].rating`, `session.strategy`.
    - Value formats: bare tokens, numbers, booleans, `null`, or JSON for arrays/objects.

#### D. Logistics

- `postpone <ID> [days]`
  Bumps due date without scheduler penalty.
- `dismiss <ID>`
  Logical delete/suspend.
- `priority <ID> <0-100>`
  Updates priority immediately.
- `scroll <ID> <pos>`
  Persists scroll position.

#### E. Session & Scheduler Config

- `session JD1|Anki [--exam YYYY-MM-DD] [--capacity <n>] [--clump <n>] [--cooldown <n>]`
- `scheduler <fsrs|sm2>`
- `clock <YYYY-MM-DD>`
  Simulates time passage.

---

## Testing & Validation

- All validation is .rv only (no JSONL fixtures).
- One Vitest suite loads all .rv files using it.each().
- Each .rv runs against fresh MemoryDataStore.
- Assertions required:
    - Per-cloze isolation: grading one cloze does not alter other clozes.
    - Ordering difference: JD1 vs Anki produce different queues.
    - Exam compression: due dates never exceed computed target interval.

---

## Implementation Phases (Test-Driven)

### Phase 1: Test-First DSL Baseline

- Write minimal .rv scripts (topic, cloze, grade, inspect-next).
- Implement .rv parser to run them end-to-end.

### Phase 2: Core Domain Skeleton

- Define core types and interfaces.
- Implement MemoryDataStore, NotePlatform, NoteManipulator.
- Make baseline scripts pass.

### Phase 3: Scheduling Core

- Implement Scheduler abstraction and FSRS.
- Add SM2 stub + explicit error on use.
- Add exam-date adjustment and .rv tests for it.

### Phase 4: Session Strategies

- Implement JD1 + Anki.
- Add .rv tests for ordering, clumps, volatile cooldown.

### Phase 5: Feature Growth via DSL

- Add new .rv files per feature (postpone, dismiss, priority, scroll).
- No feature is implemented without a new .rv test.

### Phase 6: Persistence & Migration (Deferred)

- Implement MarkdownDataStore.
- Wrap existing UI to call SessionManager.

### Phase 7: UX Integration

- Replace Obsidian review view with SessionManager consumer.
- Add logistics bar (postpone, dismiss, priority).
