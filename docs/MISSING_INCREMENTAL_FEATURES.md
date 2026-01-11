# Missing Incremental Reading Features

Comparison against SuperMemo's [minimum definition of incremental reading](https://supermemo.guru/wiki/Minimum_definition_of_incremental_reading).

---

## Current Coverage Summary

| Category                   | Implemented | Total | Coverage |
| -------------------------- | ----------- | ----- | -------- |
| First Steps (Foundational) | 9           | 10    | 90%      |
| Vital Options (Essential)  | 2           | 6     | 33%      |
| Additional Features        | 3           | 10+   | ~25%     |

### Features Covered by External Plugins

| Feature           | Plugin                    | Notes                   |
| ----------------- | ------------------------- | ----------------------- |
| Web/HTML import   | Obsidian Importer         | Keeps links and images  |
| PDF import        | Obsidian Importer / PDF++ | Text with annotations   |
| Video/audio       | Media Extended            | Timestamp links         |
| Knowledge tree UI | Folder Notes              | Click folder opens note |

---

## First Steps (Foundational)

### Implemented

| Feature              | Implementation                                            |
| -------------------- | --------------------------------------------------------- |
| Spaced repetition    | FSRS algorithm via ts-fsrs                                |
| Extracts             | `Alt+X` creates topic note with `source` link             |
| Cloze deletions      | `{{c1::text}}` syntax, per-cloze scheduling               |
| Read points          | `scroll_pos` frontmatter property for topics              |
| Priority queue       | Priority 0-100, JD1 strategy uses priority bands          |
| Repetition auto-sort | JD1: Priority-urgency scoring. Anki: Learning → Due → New |
| Rich formatting      | Obsidian's Markdown editor (always editable)              |
| Web/HTML import      | Via Obsidian Importer plugin                              |
| Image propagation    | Links (`![[...]]`) copied with extract text               |

### Missing

#### 1. Auto-Postpone

**What it does:** When queue exceeds manageable size, automatically postpone lower-priority items.

**Why it matters:** Prevents "review debt spiral" and burnout.

**Current state:** SessionManager has `capacity` config but no automatic postpone logic.

**What's needed:**

```typescript
// Add to SessionManager or as separate function
function autoPostpone(
	queue: SessionItem[],
	maxDaily: number,
): {
	toReview: SessionItem[]
	postponed: SessionItem[]
}
```

**Implementation:**

1. Add `maxDailyReviews` setting
2. On queue build, check if count exceeds limit
3. Postpone lowest-priority items by updating `due` dates
4. Show notification: "Postponed X items"

**Difficulty: Medium**

---

## Vital Options (Essential)

### Implemented

#### 1. Branch Review (Folder Filtering)

**Status: ✅ Implemented**

- Deck selection filters by folder
- `SessionManager.loadPool()` accepts `folderFilter` option
- Subfolders included by default

#### 2. Queue Strategies

**Status: ✅ Implemented**

Two strategies in `src/engine/strategies/`:

- **JD1** (default): Priority-urgency scoring with:
    - TypeWeight (topics before clozes)
    - LinkedAffinity (boosts related items)
    - UrgencyTerm from stability
    - RecencyTerm from days since review
    - Clump limit (max 3 consecutive from same note)
    - Again cooldown (5 items before re-selection)

- **Anki**: Simple due-date ordering for migration

### Missing

#### 1. Mid-Interval Review (Advance Command)

**What it does:** Review items before they're due with spacing effect correction.

**Current state:** FSRS handles elapsed time correctly, but no UI to access non-due items.

**What's needed:**

1. "Advance" command to show non-due items
2. Sort by priority for early review selection
3. Track `early: true` in revlog

**Difficulty: Low** - FSRS handles the math

---

#### 2. Add to Outstanding

**What it does:** Force an item into today's queue regardless of schedule.

**What's needed:**

```typescript
// IR/manual-queue.md or frontmatter flag
function addToOutstanding(itemId: string): void
function getOutstandingItems(): ReviewItem[]
```

**Difficulty: Low-Medium**

---

#### 3. Semantic Review Tools

**Current state:** Folder filtering only.

**Missing:**

- Search & Review (review items matching query)
- Subset Review (filter by tags, dates, status)
- Neural Review (semantic similarity)

**Difficulty: Medium to Very Hard**

---

#### 4. Overload Management (Mercy, Postpone)

**What it does:**

- **Postpone**: Push items to future dates
- **Mercy**: Bulk postpone to manage backlog
- **Auto-balance**: Spread reviews evenly

**What's needed:**

```typescript
function postponeItem(itemId: string, days: number): Promise<void>
function mercy(queue: SessionItem[], keepCount: number, spreadDays: number): Promise<void>
```

**Difficulty: Medium**

---

#### 5. Propagating References

**What it does:** Extracts inherit references from parent (citation chain).

**Current state:** Only immediate `source` link.

**What's needed:**

```yaml
# Frontmatter
source: '[[Parent]]'
original_source: '[[Textbook]]'
citations: ['Smith, 2020']
```

**Difficulty: Low-Medium**

---

## Additional Features

### Implemented

| Feature             | Status | Notes                                    |
| ------------------- | ------ | ---------------------------------------- |
| Progress statistics | ✅     | Session stats, StatsModal                |
| Review history      | ✅     | JSONL revlog                             |
| Export              | ✅     | CSV export command                       |
| Folder notes        | ✅     | `createFolderForExtractedTopics` setting |

### Not Implemented

| Feature                      | Difficulty | Notes                           |
| ---------------------------- | ---------- | ------------------------------- |
| A-Factor review algorithms   | Medium     | Alternative to FSRS for topics  |
| Source-linking UI            | Low        | Visual breadcrumb trail         |
| Visual learning tools        | Hard       | Diagram annotation, mind maps   |
| Video/audio timestamps       | Medium     | Link to specific time in media  |
| Automatic decomposition      | Very Hard  | AI-assisted extraction          |
| Progress tracking per source | Medium     | How much of a book is processed |

---

## Recommended Implementation Priority

### Phase 1: Essential Workflow ✅ Complete

- Extracts, clozes, spaced repetition
- Priority-based queue ordering (JD1)
- Folder filtering (branch review)
- Read points for topics

### Phase 2: Overload Management (High Priority)

1. **Manual Postpone** - Single item postpone command
2. **Auto-Postpone** - Automatic when queue exceeds limit
3. **Mercy** - Bulk postpone with workload balancing

### Phase 3: Review Flexibility (Medium Priority)

1. **Add to Outstanding** - Manual queue additions
2. **Advance** - Review non-due items early
3. **Search & Review** - Review by search query

### Phase 4: Knowledge Organization (Low Priority)

1. **Propagating References** - Reference chain inheritance
2. **Source-linking UI** - Breadcrumb navigation

### Phase 5: Advanced Features (Future)

1. **Neural Review** - Semantic similarity
2. **Auto-decomposition** - AI-assisted extraction
3. **Statistics Dashboard** - Full analytics

---

## Difficulty Legend

| Rating      | Meaning                                           |
| ----------- | ------------------------------------------------- |
| Low         | < 1 day, isolated changes                         |
| Low-Medium  | 1-2 days, touches multiple files                  |
| Medium      | 3-5 days, new UI components                       |
| Medium-High | 1-2 weeks, significant new subsystem              |
| Hard        | 2-4 weeks, complex UI or algorithms               |
| Very Hard   | 1+ months, requires research or external services |
