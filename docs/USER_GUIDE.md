# Incremental Reading Plugin - User Guide

## What is Incremental Reading?

Incremental reading is a learning method that combines:
1. **Extracting** important passages from source material into separate notes
2. **Creating cloze deletions** to test your understanding
3. **Spaced repetition** to review material at optimal intervals

This plugin brings incremental reading to Obsidian, letting you build a knowledge base that grows with your understanding.

---

## Concept Reference

If you're coming from SuperMemo or Anki, this table maps familiar concepts:

| Concept | SuperMemo | Anki | Obsidian IR |
|---------|-----------|------|-------------|
| **Container** | Collection | Deck | Folder |
| **Hierarchy** | Concept tree | Deck::Subdeck | Nested folders |
| **Reading material** | Topic | - | Topic (note with `#topic`) |
| **Flashcard** | Item | Card | Item (cloze in note) |
| **Cloze deletion** | Cloze | Cloze note type | `{{c1::text}}` |
| **Scheduling algorithm** | SM-18 | SM-2 / FSRS | FSRS |
| **Memory metric** | A-Factor | Ease | Stability |
| **Difficulty metric** | Difficulty | - | Difficulty |
| **Failed recall** | Lapse | Lapse | Lapse |
| **Review count** | Repetition | Reviews | Reps |
| **Importance** | Priority (0-100%) | - | Priority (0-100) |
| **Due queue** | Outstanding | Due | Due |
| **Learning phase** | Memorized/Pending | Learning | Learning |
| **Stable memory** | Interval > 21d | Mature | Review (stability > 21) |
| **Source link** | Reference | - | `source` property |
| **Review history** | Repetition history | Review log | `IR/Revlog/YYYY-MM.md` |
| **Statistics** | Statistics/Analysis | Statistics | Statistics modal |
| **Knowledge tree** | Contents | Browse | Bases views |
| **Edit during review** | Yes (always) | No (press E) | Yes (always) |

### Key Differences

**From SuperMemo:**
- No separate "collection" files - your vault IS the collection
- Folders replace the concept tree
- No "dismiss" or "postpone" - just grade and move on
- Simpler priority (0-100 number vs percentage)

**From Anki:**
- Notes are Markdown files you can edit anywhere
- No separate "note types" - just topics and clozes
- Each cloze is scheduled independently (like Anki)
- No tags for organization - use folders instead
- Built-in incremental reading (topics), not just flashcards

---

## Core Concepts

### Topics vs Items

The plugin has two types of reviewable content:

| Type | What it is | How you review it |
|------|------------|-------------------|
| **Topic** | A note containing text to read | Read through, decide how well you understood |
| **Item** | A single cloze deletion | See the text with a blank, recall the hidden answer |

### Reading Progress (Topics)

For topics, the plugin tracks **where you left off reading**. When you return to a long topic, it scrolls to your last position automatically.

A progress indicator shows how far you've read:

```
+-------------------------------------------------------------+
|  Progress: ████████░░░░░░░░░░░░░░ 35%                       |
+-------------------------------------------------------------+
|                                                             |
|  [Content scrolled to last reading position]                |
|                                                             |
```

The reading position is saved when you:
- Grade the topic (1-4)
- Press Esc to exit
- Switch to another item

This mirrors SuperMemo's behavior where topics remember your scroll position.

**Important**: A single note can contain multiple cloze deletions. Each cloze becomes a separate **item** to review independently. For example, a note with 3 clozes (c1, c2, c3) creates 3 separate items in your review queue.

### Review Items vs Notes

There's a distinction between:
- **Notes**: Markdown files in your vault (the source of truth)
- **Review Items**: Things you actually review (derived from notes)

A topic note = 1 topic review item (the whole note).
A note with N clozes = N cloze review items (one per cloze index), and the note can still remain reviewable as a topic (SuperMemo-style) until you consider it "fully processed".

### The Review Queue

When you open Review mode, the plugin builds a queue of items to review:

1. **Learning** - Items you're actively learning (reviewed recently, not yet stable)
2. **Due** - Items scheduled for review today
3. **New** - Content you haven't started learning yet

Priority order: Learning first (reinforce recent memory), then Due (prevent forgetting), then New (introduce fresh material).

### Priority

Every item has a priority (0-100, lower = higher priority). Use this to:
- Focus on important material first (priority 0-20)
- Standard importance (priority 50, the default)
- Deprioritize low-interest content (priority 80-100)

### Organizing with Folders (Decks)

Use **folders** to organize your learning material, similar to decks in Anki:

```
Biochemistry/                           # Course
├── Krebs Cycle/                        # Lecture/Topic
│   ├── Slides.md                       # Source material
│   ├── Lecture Notes.md
│   ├── Video Notes.md
│   ├── Acetyl-CoA enters the cycle.md  # Extracts (topics/items)
│   ├── Citrate is formed from.md
│   └── ATP yield per glucose.md
├── Glycolysis/
│   ├── Slides.md
│   ├── Lecture Notes.md
│   ├── Glucose to pyruvate.md
│   └── Net ATP from glycolysis.md
└── Electron Transport/
    └── ...
```

**Typical workflow:**
1. Import slides/notes into `Biochemistry/Krebs Cycle/Slides.md`
2. Read and extract key passages → creates topic notes in same folder
3. Add clozes to extracts → converts to items
4. Review by folder (just Krebs Cycle) or all Biochemistry

**Benefits of folder organization:**
- Mirrors course/lecture structure
- Extract creates notes alongside source material
- Bases can filter by folder (`file.inFolder("Biochemistry/Krebs Cycle")`)
- Nested folders = hierarchical decks

**Review by folder:**

When you press `Ctrl+Shift+R`:
- If you're in a folder with topic notes, that folder is preselected
- A **Deck Summary Screen** shows before you start reviewing

---

## Review Flow

### Screen 1: Deck List

When you open Review, you see all your decks (folders) with their stats:

```
+-------------------------------------------------------------+
|  Decks                                                      |
+-------------------------------------------------------------+
|                                        New   Learn   Due    |
|  ▼ Biochemistry                         8      3      24    |
|      Krebs Cycle                        2      1      12    |  ←── highlighted
|      Glycolysis                         3      2       8    |
|      Electron Transport                 3      0       4    |
|  ▼ Organic Chemistry                    5      0      15    |
|      Alkanes                            2      0       6    |
|      Reactions                          3      0       9    |
|  ────────────────────────────────────────────────────────── |
|  All Decks                             13      3      39    |
+-------------------------------------------------------------+
|  Today: 23 reviewed  |  Streak: 12 days                     |
+-------------------------------------------------------------+
|                    [Study Now]                              |
|                                                             |
|  [Statistics]                                    [Settings] |
+-------------------------------------------------------------+
```

**Elements:**
- **Deck tree**: Folders containing topic notes, with hierarchy
- **Per-deck counts**: New (blue), Learning (orange), Due (green)
- **All Decks row**: Total across everything
- **Today's summary**: Reviews done today, current streak
- **Study Now**: Starts review for selected deck (click row to select)

**Interactions:**
- Click a deck row to select it (highlighted)
- Double-click or press Enter to start studying immediately
- Collapse/expand folders with ▼/▶
- `Ctrl+Shift+R` from a folder preselects that deck

**Preselection:**
- Opening from `Biochemistry/Krebs Cycle/Slides.md` → Krebs Cycle is highlighted
- Opening from root → "All Decks" is selected

### Screen 2: Review

After clicking "Study Now", the review screen appears (as documented above).

Press `Esc` to return to deck summary (not exit completely).

---

## Getting Started

### 1. Create Your First Topic

1. Open any note in Obsidian
2. Select text you want to learn
3. Press `Alt+X` or run command: **Extract to Incremental Note**

This creates a new note containing:
- The selected text
- A link back to the source
- The `#topic` tag (makes it reviewable)

The original text is replaced with a link to the new note.

### 2. Add Cloze Deletions

To test yourself on specific facts:

1. Open a topic note
2. Select text you want to remember
3. Press `Alt+Z` or run command: **Create Cloze (Next Index)**

The text transforms into: `{{c1::your selected text}}`

**Next Index vs Same Index:**
- **Next Index** (`Alt+Z`): Creates c1, then c2, then c3... Each cloze is reviewed separately.
- **Same Index** (`Alt+Shift+Z`): Reuses the last index. Multiple clozes with same index are hidden together.

Clozes are stored as plain `{{cN::...}}` text in the note (no HTML wrapper).

**Example:**
```
The Krebs cycle produces {{c1::2 ATP}}, {{c2::6 NADH}}, and {{c3::2 FADH2}} per glucose molecule.
```
This creates THREE separate review items:
- Item c1: "The Krebs cycle produces [???], 6 NADH, and 2 FADH2..." → Answer: 2 ATP
- Item c2: "The Krebs cycle produces 2 ATP, [???], and 2 FADH2..." → Answer: 6 NADH
- Item c3: "The Krebs cycle produces 2 ATP, 6 NADH, and [???]..." → Answer: 2 FADH2

### 3. Start Reviewing

1. Press `Ctrl+Shift+R` or run command: **Open Review**
2. The review screen shows your first item

**For Topics:**
- Read through the content
- Press Space to show grade buttons
- Grade 1-4 based on understanding

**For Items (Clozes):**
- See the text with the cloze hidden: `[...]`
- Try to recall the answer
- Press Space to reveal
- Grade 1-4 based on recall

In review mode, cloze hiding happens in the editor itself (the note stays editable), and the header shows only the deck/folder to avoid spoilers from note titles.

**Grading Scale:**
| Grade | Key | Meaning | Result |
|-------|-----|---------|--------|
| Again | `1` | Didn't know / Forgot | Review in ~10 minutes |
| Hard | `2` | Struggled but got it | Short interval |
| Good | `3` | Knew it with effort | Normal interval |
| Easy | `4` | Knew it instantly | Longer interval |

---

## The Review Screen

```
+-------------------------------------------------------------+
|  Deck: Biochemistry/Krebs Cycle                             |
|  Due: 12  |  New: 5  |  Reviewed: 8  |  Streak: 12 days     |
+-------------------------------------------------------------+
|                                                             |
|  The Krebs cycle produces 2 ATP, [...], and 2 FADH2         |
|  per glucose molecule.                                      |
|                                                             |
+-------------------------------------------------------------+
|            [Show Answer]  or press Space                    |
+-------------------------------------------------------------+
```

After revealing:

```
+-------------------------------------------------------------+
|  Deck: Biochemistry/Krebs Cycle                             |
|  Due: 12  |  New: 5  |  Reviewed: 8  |  Streak: 12 days     |
+-------------------------------------------------------------+
|                                                             |
|  The Krebs cycle produces 2 ATP, [6 NADH], and 2 FADH2      |
|  per glucose molecule.                                      |
|                                                             |
+-------------------------------------------------------------+
|  [1 Again]  [2 Hard]  [3 Good]  [4 Easy]                    |
+-------------------------------------------------------------+
```

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Space` / `Enter` | Show answer / Advance with Good |
| `1` | Grade Again |
| `2` | Grade Hard |
| `3` | Grade Good |
| `4` | Grade Easy |
| `Alt+X` | Extract selection to new note |
| `Alt+Z` | Create cloze from selection |
| `Alt+P` | Set priority |
| `Alt+Left` | Go to source note |
| `Esc` | Return to deck list |

### Always Editable (Core IR Principle)

Unlike Anki (where cards are read-only during review), content is **always editable** - this is fundamental to incremental reading.

There's no separate "edit mode". You simply:
1. **Read** the content
2. **Select** interesting text
3. **Extract** (`Alt+X`) or **Cloze** (`Alt+Z`)
4. **Grade** when ready

```
+-------------------------------------------------------------+
|  Deck: Biochemistry/Krebs Cycle                             |
|  Due: 12  |  New: 5  |  Reviewed: 8                         |
+-------------------------------------------------------------+
|                                                             |
|  The Krebs cycle produces 2 ATP, 6 NADH, and 2 FADH2        |
|  per glucose molecule. [selected: "2 FADH2"]                |
|                                                             |
|  The cycle occurs in the mitochondrial matrix...            |
|                                                             |
+-------------------------------------------------------------+
|  [Alt+X Extract]  [Alt+Z Cloze]  [Show Answer / Space]      |
+-------------------------------------------------------------+
```

This fluid workflow is what makes incremental reading powerful:
- Read a topic → spot key facts → cloze them immediately
- Review an item → notice it needs context → edit inline
- See related content → extract for later

Changes are auto-saved. No mode switching, no friction.

---

## Browsing Your Collection

### The Bases Dashboard

The plugin creates **Bases views** showing all your review items (from `IR/Review Items/`):

**All Items view:**
| Title | Type | Cloze | Status | Priority | Due | Stability | Difficulty | Reps | Lapses | Source |
|-------|------|-------|--------|----------|-----|-----------|------------|------|--------|--------|
| ATP yield per glucose | topic | - | review | 50 | Jan 20 | 15.2 | 5.1 | 8 | 1 | [[Krebs Cycle/Slides]] |
| ATP yield per glucose | item | c1 | learning | 50 | Jan 15 | 2.1 | 6.3 | 3 | 0 | [[Krebs Cycle/Slides]] |
| ATP yield per glucose | item | c2 | new | 50 | - | 0 | 0 | 0 | 0 | [[Krebs Cycle/Slides]] |
| Glucose to pyruvate | item | c1 | review | 30 | Jan 18 | 8.5 | 4.2 | 5 | 0 | [[Glycolysis/Lecture Notes]] |

**Column definitions:**
| Column | Description |
|--------|-------------|
| Title | Note name |
| Type | `topic` (reading) or `item` (cloze) |
| Cloze | Which cloze index (c1, c2, etc.) - empty for topics |
| Status | `new`, `learning`, `review`, `relearning` |
| Priority | 0-100 (lower = more important) |
| Due | Next scheduled review date |
| Stability | Memory strength in days (FSRS metric) |
| Difficulty | How hard the item is, 0-10 (FSRS metric) |
| Reps | Total number of reviews |
| Lapses | Times you forgot (graded Again) |
| Source | Original document this was extracted from |

**Available views:**
- `IR/All Items.base` - Everything
- `IR/Due Today.base` - Items due for review
- `IR/New.base` - Items never reviewed
- `IR/Topics.base` - Only topics
- `IR/Items.base` - Only cloze items
- `IR/Struggling.base` - Items with 3+ lapses

You can sort, filter, and bulk-edit from these views.

---

## Statistics

Access via command: **Open Statistics** or from the ribbon icon.

### Today's Summary

```
Today's Progress
----------------
Reviews:    24 / 35 due
New:        5 / 10 limit
Time:       12 min
Retention:  92%
```

### Review Heatmap

GitHub-style calendar showing daily review activity:

```
        Jan                 Feb                 Mar
Mon  ░░▓▓░░▓░░░▓▓▓░░░░░▓▓░░░░▓▓▓░░░░░▓▓░░░░▓▓▓░░
Tue  ░▓▓▓░░▓▓░░▓▓▓░░░░░▓▓░░░░▓▓▓░░░░░▓▓░░░░▓▓▓░░
...

Current streak: 12 days | Longest: 45 days | Total: 156 days
```

### Collection Overview

**Card States** (pie chart):
- New: Never reviewed
- Learning: In initial learning phase
- Young: Interval < 21 days
- Mature: Interval >= 21 days

**Upcoming Reviews** (bar chart):
Forecast of reviews due each day for the next 30 days.

### Performance Metrics

**Retention Rate**: Percentage of reviews where you remembered (grade >= 2)
- Target: 90% (configurable in settings)
- Tracked over time as a line chart

**Answer Distribution**: How often you use each grade
- High "Again" rate -> Cards too hard
- High "Easy" rate -> Cards too easy

**Stability Distribution**: How well-learned your collection is
- Histogram of stability values across all items

**Difficulty Distribution**: How hard your cards are
- Histogram of difficulty values

### Workload Prediction

Estimate your daily time commitment:
```
Workload Estimate
-----------------
Current burden: 8.5 min/day
Next week avg:  12.3 min/day
Peak day:       Thursday (18 min)
```

---

## Settings

### Review Settings

| Setting | Default | Description |
|---------|---------|-------------|
| New cards per day | 10 | Max new items introduced daily |
| Maximum interval | 365 | Longest time between reviews (days) |
| Target retention | 0.9 | Desired probability of remembering |
| Extract tag | `topic` | Tag that marks notes for review |

### Extract Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Title word count | 5 | Words for auto-generated extract titles |

### Statistics Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Track review time | true | Record time spent per review |
| Show streak | true | Display streak in review header |

---

## Commands Reference

| Command | Default Hotkey | Description |
|---------|----------------|-------------|
| Extract to Incremental Note | `Alt+X` | Create topic from selection |
| Create Cloze (Next Index) | `Alt+Z` | Wrap selection as cloze, increment index |
| Create Cloze (Same Index) | `Alt+Shift+Z` | Wrap selection as cloze, reuse last index |
| Open Review | `Ctrl+Shift+R` | Start review session |
| Open Statistics | - | Show statistics modal |
| Set Priority | `Alt+P` (in review) | Change priority of current item |

---

## Tips for Effective Learning

### Extracting

- **Be selective**: Don't extract everything. Focus on important or interesting content.
- **Keep extracts focused**: One idea per extract is easier to review.
- **Maintain context**: The source link helps you return to the original.

### Creating Clozes

- **Test one fact**: Each cloze should test a single piece of information.
- **Provide context**: Include enough surrounding text to make the cloze meaningful.
- **Avoid trivial clozes**: Don't cloze common words or obvious facts.

**Good cloze:**
```
Glycolysis produces a net gain of {{c1::2 ATP}} per glucose molecule.
```

**Bad cloze:**
```
{{c1::Glycolysis}} produces a net gain of 2 ATP per glucose molecule.
```
(Testing the word "Glycolysis" is trivial - the context gives it away)

### Reviewing

- **Be honest**: Grade based on actual recall, not what you think you should know.
- **Review daily**: Even 10 minutes helps. Consistency beats intensity.
- **Use priorities**: Focus limited time on high-priority material.

### Managing Your Collection

Use the Bases dashboard to spot:
- Items with many lapses (struggling - need to be rewritten or broken down)
- Items with very low stability (not learning well)
- Unbalanced priorities

---

## Data Storage

### Where is my data?

| Data | Location |
|------|----------|
| Card metadata | Note frontmatter (YAML) |
| Review item state | `IR/Review Items/<ir_note_id>.md` |
| Review history (JSONL lines) | `IR/Revlog/YYYY-MM.md` |
| Settings | `.obsidian/plugins/incremental-reading/data.json` |

### The Note as Source of Truth

Notes are the canonical source for content and metadata. Review state lives in sidecar files. The note frontmatter contains:

```yaml
---
tags: [topic]
source: "[[Parent Note]]"
type: item
created: 2024-01-15T10:30:00
ir_note_id: "Ab3Kp9Xr2QaL"
priority: 50
scroll_pos: 0
---
```

Review state and per-cloze scheduling are stored in `IR/Review Items/<ir_note_id>.md`.

### Backup

- Notes are regular Markdown files - back up your vault as usual
- Review history can be exported to CSV from Statistics

### Privacy

All data stays local. Nothing is sent to external servers.

---

## Troubleshooting

### "No cards to review"

1. Check that notes have the `#topic` tag in frontmatter
2. New items might be limited by "New cards per day" setting
3. All items might be scheduled for future dates

### Items not appearing in Bases view

1. Ensure the Bases plugin is enabled
2. Check that notes have the correct tag

### Clozes not hiding during review

1. Verify syntax: `{{c1::text}}`
2. Ensure you're reviewing via the plugin's **Open Review** view (the plugin applies cloze hiding while reviewing)

### A cloze item has wrong scheduling

Each cloze (c1, c2, etc.) is scheduled independently. Item schedules are stored in the sidecar file and keyed by `ir_note_id + cloze_uid`.
