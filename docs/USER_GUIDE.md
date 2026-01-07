# Incremental Reading Plugin - User Guide

## What is Incremental Reading?

Incremental reading is a learning method that combines:
1. **Extracting** important passages from source material into separate notes
2. **Creating cloze deletions** to test your understanding
3. **Spaced repetition** to review material at optimal intervals

This plugin brings incremental reading to Obsidian, letting you build a knowledge base that grows with your understanding.

---

## Getting Started

### 1. Create Your First Topic

1. Open any note in Obsidian
2. Select text you want to learn
3. Run command: **Extract to topic note**

This creates a new note containing:
- The selected text
- A link back to the source
- The `#topic` tag (makes it reviewable)

The original text is replaced with a link to the new note.

### 2. Add Cloze Deletions

To test yourself on specific facts:

1. Open a topic note
2. Select text you want to remember
3. Run command: **Cloze selection**

The text transforms into: `{{c1::your selected text}}`

**Cloze selection vs Cloze selection (same index):**
- **Cloze selection**: Creates c1, then c2, then c3... Each cloze is reviewed separately.
- **Cloze selection (same index)**: Reuses the last index. Multiple clozes with same index are hidden together.

**Example:**
```
The Krebs cycle produces {{c1::2 ATP}}, {{c2::6 NADH}}, and {{c3::2 FADH2}} per glucose molecule.
```
This creates THREE separate review items:
- Item c1: "The Krebs cycle produces [???], 6 NADH, and 2 FADH2..." → Answer: 2 ATP
- Item c2: "The Krebs cycle produces 2 ATP, [???], and 2 FADH2..." → Answer: 6 NADH
- Item c3: "The Krebs cycle produces 2 ATP, 6 NADH, and [???]..." → Answer: 2 FADH2

### 3. Start Reviewing

1. Run command: **Open review**
2. The deck summary shows your folders with counts
3. Click a deck to select it, then click "Study Now"

**For Topics (extracts without clozes):**
- Read through the content
- Grade 1-4 based on understanding

**For Items (Clozes):**
- See the text with the cloze hidden as `[...]`
- Try to recall the answer
- Click "Show Answer" to reveal
- Grade 1-4 based on recall

---

## Core Concepts

### Topics vs Items

The plugin has two types of reviewable content:

| Type | What it is | How you review it |
|------|------------|-------------------|
| **Topic** | A note tagged with `#topic` without clozes | Read through, grade how well you understood |
| **Item** | A cloze deletion in a note | See text with blank, recall the hidden answer |

A single note can contain multiple cloze deletions. Each cloze becomes a separate **item** to review independently.

### The Review Queue

When you open Review mode, the plugin builds a queue:

1. **Learning** - Items you're actively learning (reviewed recently, not yet stable)
2. **Due** - Items scheduled for review today
3. **New** - Content you haven't started learning yet

Priority order: Learning first, then Due, then New.

### Priority

Every item has a priority (0-100, lower = higher priority). Use the **Set priority** command to adjust.

### Organizing with Folders

Use folders to organize your learning material. The deck summary screen shows folders as "decks" with their review counts.

---

## The Review Screen

### Deck Summary

When you open Review, you see your folders with their stats:

```
Decks                                    New   Learn   Due
  Biochemistry                            8      3      24
    Krebs Cycle                           2      1      12
    Glycolysis                            3      2       8
  ──────────────────────────────────────────────────────────
  All Decks                              13      3      39

  Today: 23 reviewed  |  Streak: 12 days

                    [Study Now]
```

Click a deck row to select it, then click "Study Now".

### Review Interface

For cloze items, you first see the question (cloze hidden), then click "Show Answer" to reveal.

**Grading Scale:**
| Grade | Meaning | Result |
|-------|---------|--------|
| Again (1) | Didn't know / Forgot | Review again soon |
| Hard (2) | Struggled but got it | Short interval |
| Good (3) | Knew it with effort | Normal interval |
| Easy (4) | Knew it instantly | Longer interval |

---

## Commands

| Command | Description |
|---------|-------------|
| Extract to topic note | Create topic from selection |
| Cloze selection | Wrap selection as cloze, increment index |
| Cloze selection (same index) | Wrap selection as cloze, reuse last index |
| Open review | Start review session |
| Set priority | Change priority of current note |
| Open statistics | Show statistics modal |
| Export review history | Export revlog to CSV |

**Note:** No default hotkeys are assigned. Set your preferred hotkeys in **Settings → Hotkeys**.

---

## Statistics

Run **Open statistics** to see:

- **Total reviews** - All-time review count
- **Retention** - Percentage of reviews where you remembered
- **Today's count** - Reviews completed today
- **Streak** - Consecutive days with reviews
- **Answer distribution** - How often you used each grade
- **7-day forecast** - Upcoming reviews per day
- **14-day history** - Recent daily review counts

---

## Settings

Access via **Settings → Community plugins → Incremental Reading**.

| Setting | Default | Description |
|---------|---------|-------------|
| New cards per day | 10 | Max new items introduced daily |
| Maximum interval | 365 | Longest time between reviews (days) |
| Request retention | 0.9 | Target probability of remembering |
| Extract tag | `topic` | Tag that marks notes for review |
| Extract title words | 5 | Words for auto-generated extract titles |
| Track review time | On | Record time spent per review |
| Show streak | On | Display streak in deck summary |

---

## Data Storage

| Data | Location |
|------|----------|
| Review item state | `IR/Review Items/<note-id>.md` |
| Review history | `IR/Revlog/YYYY-MM.md` (JSONL format) |
| Settings | `.obsidian/plugins/obsidian-incremental-reading/data.json` |

Your notes remain clean - all scheduling metadata is kept in separate sidecar files.

---

## Tips for Effective Learning

### Extracting

- **Be selective**: Don't extract everything. Focus on important content.
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

---

## Troubleshooting

### "No items to review"

1. Check that notes have the `#topic` tag
2. New items might be limited by "New cards per day" setting
3. All items might be scheduled for future dates

### Clozes not hiding during review

1. Verify syntax: `{{c1::text}}`
2. Ensure you're reviewing via the **Open review** command
