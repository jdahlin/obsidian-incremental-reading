# Incremental Reading for Obsidian

## What is Incremental Reading?

Incremental Reading (IR) is a learning technique pioneered by SuperMemo that helps you:

1. **Read more efficiently** - Process articles in small chunks instead of marathon sessions
2. **Remember what you read** - Convert important passages into flashcards with spaced repetition
3. **Never lose your place** - The system remembers where you stopped in each article
4. **Prioritize intelligently** - Important material surfaces first; less important material waits

Unlike traditional reading where you finish one article before starting another, IR lets you interleave many articles. This keeps your attention fresh and helps you make connections between different sources.

---

## Core Concepts

### Topics vs Items

| Type | What it is | Example | How you interact |
|------|------------|---------|------------------|
| **Topic** | Reading material | An article, section, or paragraph | Read, extract key parts, schedule for later |
| **Item** | Active recall test | A cloze deletion or Q&A | Try to recall the answer, grade yourself |

Your workflow: **Import → Read → Extract → Cloze → Review**

### The Learning Cycle

```
┌─────────────────────────────────────────────────────────┐
│  1. IMPORT                                              │
│     Paste article into Obsidian                         │
│                    ↓                                    │
│  2. READ (Topic)                                        │
│     Read a portion, extract important parts             │
│                    ↓                                    │
│  3. EXTRACT (Topic → Topic)                             │
│     Key passage becomes its own note                    │
│                    ↓                                    │
│  4. CLOZE (Topic → Item)                                │
│     Create fill-in-the-blank from extract               │
│                    ↓                                    │
│  5. REVIEW (Items)                                      │
│     Test yourself, algorithm schedules next review      │
└─────────────────────────────────────────────────────────┘
```

### Priority Queue

Not all material is equally important. Use priority (0-100) to control what you see first:

| Priority | Meaning | Example |
|----------|---------|---------|
| 0-20 | Critical | Exam material due this week |
| 21-40 | High | Core concepts for your field |
| 41-60 | Medium | Interesting but not urgent |
| 61-80 | Low | Background reading |
| 81-100 | Someday | Archive, might never review |

Lower number = higher priority. Material at priority 0 always surfaces before priority 50.

---

## Keyboard Shortcuts

These follow SuperMemo conventions where possible.

### Reading & Extraction

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Alt+X` | Extract | Create a new Topic from selected text |
| `Alt+Z` | Cloze | Wrap selection in `{{c1::...}}` (converts Topic to Item) |
| `Ctrl+Shift+Z` | Cloze (same index) | Add to existing cloze group |

### Review Session

| Shortcut | Action | For Topics | For Items |
|----------|--------|------------|-----------|
| `Space` | Show Answer | Scroll to read point | Reveal cloze |
| `Enter` | Advance | Same as pressing current grade | Same |
| `1` | Grade: Again | Review in 10 min | Failed recall, review soon |
| `2` | Grade: Hard | Review in 1 day | Difficult, shorter interval |
| `3` | Grade: Good | Review in 3 days | Normal recall, standard interval |
| `4` | Grade: Easy | Review in 1 week | Easy, longer interval |
| `Escape` | Exit Review | Return to normal editing | |

### Navigation

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Ctrl+Shift+R` | Open Review | Start review session |
| `Alt+Left` | Go to Source | Open parent note (breadcrumb up) |
| `Alt+P` | Set Priority | Change priority of current card |

---

## Getting Started

### Step 1: Import an Article

Paste or type an article into a new note. No special formatting needed.

### Step 2: Start Reading

Open the article and read until you find something important.

### Step 3: Extract Key Passages

Select the important text and press `Alt+X`. This:
- Creates a new note containing just that passage
- Links back to the source article
- Adds the `#extract` tag so it enters your review queue
- Sets it as a **Topic** (reading material)

Example:
```
Original article: "The mitochondria is the powerhouse of the cell.
It produces ATP through oxidative phosphorylation..."

You select "The mitochondria is the powerhouse of the cell"
Press Alt+X

New note created: "The mitochondria is the.md"
---
source: "[[Original article]]"
tags: [extract]
type: topic
priority: 50
...
---
The mitochondria is the powerhouse of the cell.
```

### Step 4: Create Cloze Deletions

Once you've extracted key facts, turn them into testable items.

Select the key term and press `Alt+Z`:
```
Before: The mitochondria is the powerhouse of the cell.
After:  The {{c1::mitochondria}} is the powerhouse of the cell.
```

This converts the Topic into an **Item** (active recall).

### Step 5: Review Daily

Press `Ctrl+Shift+R` to start a review session. The plugin shows you:

1. **Learning cards** - Recently failed or new items in short intervals
2. **Due cards** - Items scheduled for today, sorted by priority
3. **New cards** - Unreviewed items (limited per day)

For each card:
1. Try to recall the answer (for Items) or continue reading (for Topics)
2. Press `Space` to reveal
3. Grade yourself `1-4`
4. Card is rescheduled automatically

---

## The Review Interface

```
┌─────────────────────────────────────────────────────────┐
│  📄 Article > 📑 Section > 📝 Current Card              │  ← Breadcrumbs
├─────────────────────────────────────────────────────────┤
│  Due: 12 | New: 5 | Done: 8                             │  ← Queue stats
├─────────────────────────────────────────────────────────┤
│                                                         │
│  The {{c1::mitochondria}} is the powerhouse of the      │  ← Card content
│  cell.                                                  │
│                                                         │
│  [Click or press Space to reveal]                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [1 Again]  [2 Hard]  [3 Good]  [4 Easy]                │  ← Grade buttons
└─────────────────────────────────────────────────────────┘
```

### Grading Guide

| Grade | When to use | Effect on interval |
|-------|-------------|-------------------|
| **1 Again** | Forgot completely | Reset to short interval (minutes) |
| **2 Hard** | Struggled to recall | Shorter than normal |
| **3 Good** | Recalled with effort | Normal interval growth |
| **4 Easy** | Instant recall | Longer interval, card matures faster |

The FSRS algorithm adjusts intervals based on your grading history. Cards you struggle with appear more often; easy cards space out further.

---

## Browsing Your Collection

The plugin creates database views in the `IR/` folder:

| View | Shows |
|------|-------|
| **Due Today.base** | All cards due for review now |
| **Topics.base** | Reading material only |
| **Items.base** | Cloze/recall cards only |
| **New Cards.base** | Cards never reviewed |
| **Learning.base** | Cards in learning phase |
| **All Extracts.base** | Everything with `#extract` tag |
| **By Source.base** | Cards grouped by parent article |

Open any `.base` file to see a filterable, sortable table of your cards. You can:
- Click to open a card
- Edit priority, due date, or status inline
- Sort by any column
- Create custom views

---

## Tips for Effective IR

### 1. Extract Liberally, Cloze Sparingly
- Extract any passage that might be useful later
- Only create clozes for facts you truly need to memorize
- Topics (reading material) are cheap; Items (tests) require effort

### 2. Use Priority to Manage Overload
- When you have too much to review, raise priority on less important cards
- Priority 80+ cards may never surface if you have enough priority 50 cards
- This is intentional - focus on what matters

### 3. Trust the Algorithm
- Don't second-guess intervals
- If you grade honestly, FSRS optimizes your retention
- Occasional forgetting is normal and helps learning

### 4. Keep Sessions Short
- 15-30 minutes of review is better than 2-hour marathons
- Review daily rather than cramming weekly
- The system handles scheduling; you just show up

### 5. Let Topics Simmer
- Don't rush to turn everything into clozes
- Reading the same passage multiple times builds understanding
- Extract → Re-read → Extract deeper → Eventually cloze

---

## Frontmatter Reference

Each extract has this metadata (editable in Properties view):

```yaml
---
source: "[[Parent Note]]"    # Where this came from
tags: [extract]              # Required for queue
type: topic                  # topic | item
created: 2026-01-06T10:30:00
due: 2026-01-07T09:00:00     # Next review time
status: new                  # new | learning | review | relearning
priority: 50                 # 0 (highest) to 100 (lowest)
stability: 4.2               # FSRS memory strength
difficulty: 3.5              # FSRS item difficulty
reps: 5                      # Successful reviews
lapses: 1                    # Times forgotten
scroll_pos: 1250             # Reading position (Topics only)
---
```

You can manually edit these, but normally the plugin manages them.

---

## Troubleshooting

### Cards not appearing in review
- Check the note has `tags: [extract]`
- Check `due` is in the past (not future)
- Check `status` is not stuck on an invalid value

### Cloze not hiding in preview
- Ensure you're in Reading View (not Edit mode)
- Check the CSS is loaded (plugin must be enabled)

### Lost my place in an article
- The plugin saves `scroll_pos` for Topics
- If it's not restoring, check the frontmatter has `type: topic`

### Too many reviews
- Raise priority on less important cards (60-80)
- Set `maxReviewsPerDay` in settings
- Delete or suspend cards you no longer need

---

## Glossary

| Term | Definition |
|------|------------|
| **Extract** | A note created from selected text, linked to its source |
| **Topic** | Reading material - you read and extract from it |
| **Item** | A testable card - you try to recall the answer |
| **Cloze** | A fill-in-the-blank format: `{{c1::answer}}` |
| **Priority** | 0-100 importance ranking (lower = more important) |
| **Interval** | Days until next review |
| **Stability** | FSRS metric - how well you know the card |
| **Lapse** | When you forget a previously-known card |
| **FSRS** | Free Spaced Repetition Scheduler - the algorithm |

---

## Further Reading

- [SuperMemo Incremental Reading Guide](https://super-memory.com/help/read.htm)
- [FSRS Algorithm Explanation](https://github.com/open-spaced-repetition/fsrs4anki/wiki)
- [Obsidian Bases Documentation](https://help.obsidian.md/bases)
