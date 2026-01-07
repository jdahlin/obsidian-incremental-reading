# Missing Incremental Reading Features

This document compares the current implementation against SuperMemo's minimum definition of incremental reading, detailing what's missing and what would be needed to implement each feature.

**Reference**: [Minimum definition of incremental reading](https://supermemo.guru/wiki/Minimum_definition_of_incremental_reading)

---

## Current Coverage Summary

| Category | Implemented | Total | Coverage |
|----------|-------------|-------|----------|
| First Steps (Foundational) | 8 | 10 | 80% |
| Vital Options (Essential) | 1 | 6 | 17% |
| Additional Features | 2 | 10+ | ~15% |

### Features Covered by External Plugins

| Feature | Plugin | Notes |
|---------|--------|-------|
| Web/HTML import | [Obsidian Importer](https://github.com/obsidianmd/obsidian-importer) | Handles HTML, keeps links and images |
| PDF import | Obsidian Importer / PDF++ | Extracts text with annotations |
| Video/audio | Media Extended / Timestamp Notes | Links to specific timestamps |
| Knowledge tree UI | [Folder Notes](https://github.com/LostPaul/obsidian-folder-notes) | Click folder to open note |

These are not reimplemented - the IR plugin integrates with them.

---

## First Steps (Foundational)

### Implemented

| Feature | Implementation |
|---------|----------------|
| Spaced repetition | FSRS algorithm via ts-fsrs |
| Extracts | `Alt+X` creates topic note with `source` link |
| Cloze deletions | `{{c1::text}}` syntax, per-cloze scheduling |
| Read points | `scroll_pos` frontmatter property for topics |
| Priority queue | Priority 0-100, affects queue ordering |
| Repetition auto-sort | Queue order: Learning → Due → New |
| Rich formatting | Obsidian's Markdown editor (always editable) |
| Web/HTML import | Via Obsidian Importer plugin (links/images preserved) |
| Image propagation | Links (`![[...]]`) copied with extract text |

### Missing

#### 1. Auto-Postpone

**What it does in SuperMemo:**
When your review queue exceeds a manageable size, SuperMemo automatically postpones lower-priority items to future days. This prevents the "review debt spiral" where falling behind creates an ever-growing backlog.

**Why it matters:**
Without auto-postpone, users who miss a day (or have a heavy day) face an overwhelming queue. This leads to:
- Burnout from marathon review sessions
- Abandoning the system entirely
- Cherry-picking items (breaking the algorithm)

**What's needed to implement:**

```typescript
interface PostponeOptions {
  maxDailyReviews: number;      // e.g., 100
  postponeStrategy: 'priority' | 'due-date' | 'random';
  spreadDays: number;           // How many days to spread postponed items
}

function autoPostpone(
  queue: ReviewItem[],
  options: PostponeOptions,
  now: Date
): { toReview: ReviewItem[], postponed: ReviewItem[] } {
  // 1. Sort by priority (lowest = most important)
  // 2. Take top N items for today
  // 3. Spread remaining items across future days
  // 4. Update due dates in sidecars
}
```

**Implementation steps:**
1. Add `maxDailyReviews` setting
2. On queue build, check if count exceeds limit
3. Postpone excess items by updating their `due` dates
4. Show notification: "Postponed X items to manage workload"

**Difficulty: Medium**
- Core logic is straightforward
- Need UI to configure and show postpone status
- Need to decide postpone strategy (by priority? by staleness?)

---

#### 2. Extract/Cloze Hierarchy (Knowledge Tree)

**What it does in SuperMemo:**
SuperMemo maintains a visual tree showing the parent-child relationships between topics and items. You can see that "ATP yield" was extracted from "Krebs Cycle lecture", which came from "Biochemistry course". This tree is navigable and reviewable as a unit.

**Current state:**
- `source` property links to parent note
- Folder structure provides visual hierarchy
- Branch review = folder review (already works!)

**Solution: Use File Tree + Folder Notes Plugin**

Instead of building a custom tree UI, leverage Obsidian's file explorer with the [Folder Notes](https://github.com/LostPaul/obsidian-folder-notes) plugin:

```
BEFORE (flat):
Biochemistry/
├── Krebs Cycle.md          # Topic note
├── ATP yield.md            # Extract (unclear parent)
└── NADH production.md

AFTER (with folder notes):
Biochemistry/
└── Krebs Cycle/            # Folder (click opens the note)
    ├── Krebs Cycle.md      # The note itself (folder note)
    ├── ATP yield.md        # Extract - clearly from Krebs Cycle
    └── NADH production.md  # Extract - clearly from Krebs Cycle
```

**Integration approach:**

```typescript
// On extract: convert source note to folder note if needed
async function convertNoteToFolderNote(app: App, file: TFile): Promise<TFile> {
  const fileName = file.basename;
  const parentPath = file.parent?.path ?? '';
  const newFolderPath = parentPath ? `${parentPath}/${fileName}` : fileName;
  const newFilePath = `${newFolderPath}/${fileName}.md`;

  // Create folder
  try {
    await app.vault.createFolder(newFolderPath);
  } catch {
    // Folder may already exist
  }

  // Move file into folder (fileManager keeps links intact)
  await app.fileManager.renameFile(file, newFilePath);

  return app.vault.getAbstractFileByPath(newFilePath) as TFile;
}

// Extract command creates note inside source's folder
async function extractToIncrementalNote(sourceFile: TFile, selection: string) {
  // If source isn't already a folder note, convert it
  if (!isInsideFolderNote(sourceFile)) {
    sourceFile = await convertNoteToFolderNote(app, sourceFile);
  }

  // Create extract inside source's folder
  const extractPath = `${sourceFile.parent.path}/${extractTitle}.md`;
  // ...
}
```

**Benefits:**
- No custom tree UI needed - use Obsidian's file explorer
- Folder Notes plugin makes folders clickable (opens the note)
- Branch review = review folder (already implemented)
- `source` property still useful for "go to parent" navigation
- Works with all Obsidian tools (search, graph, etc.)

**Implementation steps:**
1. Modify extract command to convert source to folder note
2. Place extracts inside source's folder
3. Keep `source` property for direct parent link
4. Detect if Folder Notes plugin is installed for enhanced UX

**Difficulty: Low**
- ~15 lines of code for folder note conversion
- No custom UI needed
- Optional dependency on Folder Notes plugin

---

#### 3. Image Propagation

**What it does in SuperMemo:**
When you extract text that references an image, the image is automatically included in the extract. Images are localized (downloaded) and travel with the content.

**Current state: Mostly Working**
- Image references (`![[image.png]]`) are copied with the extract text
- Obsidian resolves the links automatically (images render correctly)
- Images stay in original location (not copied to extract's folder)

**What works:**
```markdown
# Source note
Here is a diagram: ![[krebs-cycle.png]]

# After extracting that text:
# Extract note
Here is a diagram: ![[krebs-cycle.png]]  ← Link works, image renders
```

**Optional enhancement - copy images to extract folder:**

This is only needed if you want images to physically travel with extracts (e.g., for export or if source might be deleted).

```typescript
async function extractWithImageCopy(
  app: App,
  selection: string,
  sourceFile: TFile,
  targetFolder: string
): Promise<string> {
  // 1. Find image references in selection
  const imageRegex = /!\[\[([^\]]+)\]\]|!\[.*?\]\(([^)]+)\)/g;

  // 2. For each image, copy to target folder
  // 3. Update references to point to new location
  // 4. Return modified content
}
```

**Difficulty: Low (optional enhancement)**
- Current behavior is acceptable for most workflows
- Image copying adds complexity (duplicates, large files)
- Only implement if export/portability is needed

---

#### 4. Auto-Sort Improvements

**What it does in SuperMemo:**
Beyond basic priority sorting, SuperMemo considers:
- **Optimum review time**: Items are sorted by how "overdue" they are
- **Priority × urgency**: Combines importance with scheduling pressure
- **Randomization within bands**: Prevents predictable review order

**Current state:**
- Fixed order: Learning → Due → New
- Within each category: sorted by priority, then due date
- No randomization

**What's needed to implement:**

```typescript
function calculateReviewUrgency(item: ReviewItem, now: Date): number {
  const daysOverdue = daysBetween(item.state.due, now);
  const priorityFactor = (100 - item.state.priority) / 100;
  const overdueFactor = Math.min(daysOverdue / 7, 2); // Cap at 2x
  return priorityFactor * (1 + overdueFactor);
}

function sortWithRandomization(items: ReviewItem[], bandSize: number): ReviewItem[] {
  // 1. Sort by urgency
  // 2. Shuffle within bands of N items
  // 3. Return result
}
```

**Difficulty: Low**
- Algorithm changes only
- No new UI needed
- Add setting for randomization band size

---

## Vital Options (Essential)

### Partially Implemented

#### Branch Review (Folder Filtering)

**Current state:**
- Can select a deck (folder) to review
- Reviews all items in that folder and subfolders

**What's missing:**
- Review specific subtree from knowledge tree (not just folder)
- "Subset review" - review items matching a search query
- "Neural review" - review related items based on content similarity

---

### Missing

#### 1. Mid-Interval Review with Spacing Effect Correction

**What it does in SuperMemo:**
If you review an item before it's due (early review), the scheduling algorithm adjusts for the reduced spacing effect. Reviewing too early provides less memory benefit, so the next interval is calculated accordingly.

**Why it matters:**
Without this correction:
- Early reviews give full credit (inflating intervals)
- Users can "game" the system by reviewing early
- Memory model becomes inaccurate

**Current state:**
- FSRS handles this partially (it considers elapsed time)
- No explicit early review handling in UI
- No "Advance" command to deliberately review early

**What's needed to implement:**

```typescript
// FSRS already handles elapsed time in its calculations
// What we need is UI to trigger early review

function reviewEarly(item: ReviewItem, now: Date): void {
  // 1. Check if item is not yet due
  // 2. Mark as "early review" in revlog
  // 3. FSRS will handle the spacing adjustment
}

// UI: "Advance" button or command
// Shows items not yet due, sorted by priority
```

**Implementation steps:**
1. Add "Review Early" or "Advance" command
2. Show non-due items sorted by priority
3. Track early reviews in revlog (add `early: true` field)
4. Verify FSRS handles elapsed time correctly

**Difficulty: Low**
- FSRS already handles the math
- Just need UI to access non-due items

---

#### 2. Add to Outstanding / Manual Queue Manipulation

**What it does in SuperMemo:**
"Add to Outstanding" forces an item into today's review queue, regardless of its scheduled date. This is useful when you encounter something during browsing that you want to review immediately.

**Why it matters:**
- Serendipitous learning: spot something while browsing, add to today's queue
- Targeted practice: manually queue items before an exam
- Fix scheduling mistakes: force review of mis-scheduled items

**What's needed to implement:**

```typescript
interface ManualQueueEntry {
  itemId: string;
  addedAt: Date;
  reason?: string;
}

// Persistent storage for manual additions
// IR/manual-queue.json or frontmatter property

function addToOutstanding(item: ReviewItem): void {
  // 1. Add to manual queue list
  // 2. Queue builder checks manual list first
}

function removeFromOutstanding(item: ReviewItem): void {
  // Remove from manual queue (reviewed or cancelled)
}
```

**Implementation steps:**
1. Add `IR/manual-queue.md` or use frontmatter flag
2. Modify queue builder to include manual items first
3. Add command "Add to Outstanding" (works from any note)
4. Add command "View Outstanding" to see manual queue
5. Clear manual flag after review

**Difficulty: Low-Medium**
- Simple data storage
- Queue builder modification
- Need UI for viewing/managing manual queue

---

#### 3. Semantic Review Tools

**What it does in SuperMemo:**

- **Search & Review**: Search for items matching a query, review the results
- **Branch Review**: Review all items under a knowledge tree node
- **Subset Review**: Define a filter (tag, folder, date range), review matching items
- **Neural Review**: Review items semantically related to current item

**Why it matters:**
- Targeted study before exams ("review everything about mitochondria")
- Contextual learning (review related concepts together)
- Maintenance (review all items from a specific source)

**Current state:**
- Folder filtering only (deck selection)
- No search-based review
- No semantic/neural features

**What's needed to implement:**

```typescript
// Search & Review
function searchAndReview(app: App, query: string): ReviewItem[] {
  // 1. Search notes/items matching query
  // 2. Build queue from results
  // 3. Enter review mode with this queue
}

// Subset Review
interface SubsetFilter {
  folders?: string[];
  tags?: string[];
  statusIn?: Status[];
  dueBefore?: Date;
  dueAfter?: Date;
  minLapses?: number;
  maxStability?: number;
  // ... more filters
}

function subsetReview(app: App, filter: SubsetFilter): ReviewItem[] {
  // Apply all filters, build queue
}

// Neural Review (advanced)
function neuralReview(app: App, seedItem: ReviewItem): ReviewItem[] {
  // 1. Extract keywords/embeddings from seed item
  // 2. Find similar items (TF-IDF, embeddings, or Obsidian's link graph)
  // 3. Build queue from similar items
}
```

**Implementation steps:**

**Phase 1 - Search & Review (Medium):**
1. Add search input to deck list screen
2. Use Obsidian's search API to find matching notes
3. Filter to reviewable items
4. Build queue and start review

**Phase 2 - Subset Review (Medium):**
1. Create filter builder UI (modal with filter options)
2. Apply filters to item list
3. Save filter presets for reuse

**Phase 3 - Neural Review (Hard):**
1. Build semantic index (keywords, links, or embeddings)
2. Find similar items on demand
3. Requires significant computation or external service

**Difficulty: Medium to Very Hard**
- Search & Subset: Medium (use Obsidian APIs)
- Neural: Very Hard (requires NLP/embeddings)

---

#### 4. Overload Management (Mercy, Postpone)

**What it does in SuperMemo:**

- **Mercy**: Temporarily reduces the review burden by postponing items
- **Postpone**: Manually push selected items to future dates
- **Auto-balance**: Spread reviews evenly across days

**Why it matters:**
Real life happens. Illness, travel, busy periods - users need ways to manage backlog without breaking the system or giving up entirely.

**What's needed to implement:**

```typescript
// Manual Postpone
async function postponeItem(
  item: ReviewItem,
  days: number,
  reason?: string
): Promise<void> {
  const newDue = addDays(new Date(), days);
  await updateItemDue(item, newDue);
  await logPostpone(item, days, reason);
}

// Bulk Postpone (Mercy)
async function mercy(
  queue: ReviewItem[],
  options: {
    keepCount: number;      // How many to keep for today
    spreadDays: number;     // Spread rest over N days
    strategy: 'priority' | 'random' | 'due-order';
  }
): Promise<{ kept: ReviewItem[], postponed: ReviewItem[] }> {
  // 1. Sort by strategy
  // 2. Keep top N
  // 3. Distribute rest across future days
  // 4. Update due dates
}

// Auto-Balance
async function balanceWorkload(
  items: ReviewItem[],
  targetPerDay: number,
  days: number
): Promise<void> {
  // Redistribute due dates to achieve even daily load
}
```

**Implementation steps:**
1. Add "Postpone" command (single item, prompt for days)
2. Add "Mercy" command (bulk postpone with options)
3. Add workload visualization (calendar showing daily counts)
4. Add "Balance" command to redistribute
5. Settings: default postpone days, max daily reviews

**Difficulty: Medium**
- Core logic is straightforward
- Need good UI for bulk operations
- Need visualization of workload distribution

---

#### 5. Propagating References

**What it does in SuperMemo:**
When you extract from a topic, the extract inherits all references (sources, citations) from the parent. As you extract deeper, the reference chain grows, maintaining full provenance.

**Current state:**
- `source` property links to immediate parent only
- No reference inheritance
- No automatic citation propagation

**What's needed to implement:**

```typescript
interface References {
  source: string;           // Immediate parent
  originalSource?: string;  // Root source (e.g., textbook)
  citations?: string[];     // Accumulated citations
  url?: string;             // Original URL if web import
}

async function extractWithReferences(
  app: App,
  selection: string,
  sourceFile: TFile
): Promise<void> {
  // 1. Read parent's references
  // 2. Create extract with inherited references
  // 3. Add parent to reference chain
}

// Frontmatter example:
// ---
// source: "[[Parent Extract]]"
// original_source: "[[Textbook Chapter 5]]"
// citations:
//   - "Smith et al., 2020"
//   - "Jones, 2019"
// ---
```

**Implementation steps:**
1. Define reference schema in frontmatter
2. On extract, copy parent's references
3. Append parent to reference chain
4. Add UI to view full reference chain
5. Add command to navigate to original source

**Difficulty: Low-Medium**
- Data model is simple
- Extract command modification is straightforward
- UI for viewing chain is optional but helpful

---

## Additional Features

### Partially Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Progress statistics | ⚠️ | Session stats exist, full modal planned |
| Review history | ✅ | JSONL revlog |
| Export | ⚠️ | CSV export planned |

### Not Implemented

| Feature | Difficulty | Notes |
|---------|------------|-------|
| A-Factor review algorithms | Medium | Alternative to FSRS for topics |
| Source-linking UI | Low | Visual breadcrumb trail |
| Visual learning tools | Hard | Diagram annotation, mind maps |
| Video/audio timestamps | Medium | Link to specific time in media |
| Automatic decomposition | Very Hard | AI-assisted extraction |
| Progress tracking per source | Medium | How much of a book is processed |

---

## Recommended Implementation Priority

### Phase 1: Essential Workflow (Now)
Already implemented: extracts, clozes, spaced repetition, priority, read points.

### Phase 2: Overload Management (High Priority)
1. **Manual Postpone** - Single item postpone command
2. **Auto-Postpone** - Automatic when queue exceeds limit
3. **Mercy** - Bulk postpone with workload balancing

*Why*: Without overload management, users will abandon the system when life gets busy.

### Phase 3: Review Flexibility (Medium Priority)
1. **Add to Outstanding** - Manual queue additions
2. **Search & Review** - Review by search query
3. **Subset Review** - Review by filter criteria

*Why*: Enables targeted study and serendipitous learning.

### Phase 4: Knowledge Organization (Low-Medium Priority)
1. **Folder Notes Integration** - Convert source to folder on extract (Low)
2. **Branch Review** - Already works via folder selection
3. **Propagating References** - Reference chain inheritance (Low-Medium)

*Why*: Folder-based hierarchy + Folder Notes plugin provides knowledge tree without custom UI.

### Phase 5: Advanced Features (Low Priority)
1. **Neural Review** - Semantic similarity
2. **Auto-decomposition** - AI-assisted extraction
3. **Statistics Dashboard** - Full analytics

*Why*: Nice to have but not essential for core workflow.

---

## Difficulty Legend

| Rating | Meaning |
|--------|---------|
| Low | < 1 day, isolated changes |
| Low-Medium | 1-2 days, touches multiple files |
| Medium | 3-5 days, new UI components |
| Medium-High | 1-2 weeks, significant new subsystem |
| Hard | 2-4 weeks, complex UI or algorithms |
| Very Hard | 1+ months, requires research or external services |
