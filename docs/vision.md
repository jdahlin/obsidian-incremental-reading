# Vision: Incremental Reading System

A cross-platform system for learning from any content through SuperMemo-inspired incremental reading, spaced repetition, and active recall.

## Philosophy

Learning happens best when you:

1. **Read incrementally** - Break large content into digestible pieces over time
2. **Extract what matters** - Pull out key concepts as you read
3. **Transform into questions** - Convert passive highlights into active recall (clozes)
4. **Review with spacing** - Let the algorithm schedule optimal review times
5. **Learn anywhere** - Seamlessly continue across devices

The system should feel like a focused reading environment, not a complex note-taking app. You're here to learn, not to organize.

## Core Experience

### The Reading Flow

```
Import → Read → Extract → Cloze → Review → Remember
```

1. **Import** content from anywhere (web, video, PDF, notes)
2. **Read** at your own pace, marking progress
3. **Extract** key passages as you go
4. **Cloze** important facts for active recall
5. **Review** when the algorithm says it's time
6. **Remember** long-term through spaced repetition

### What Makes This Different

| Traditional Flashcards | Incremental Reading       |
| ---------------------- | ------------------------- |
| Create cards upfront   | Cards emerge from reading |
| Disconnected facts     | Context preserved         |
| All or nothing         | Gradual processing        |
| Memorization focus     | Understanding + retention |
| Static content         | Living, evolving notes    |

## Content Sources

### Web Articles

Clip articles directly from the browser. The system extracts clean content, saves it locally, and queues it for reading.

- Browser extension for one-click capture
- Readability extraction (no ads, no clutter)
- Offline access to all saved content
- Reading progress tracked across sessions

### Video (YouTube, lectures, courses)

Video learning with transcript-based extraction.

- Import YouTube videos by URL
- Synchronized transcript for reading/skimming
- Screenshot capture at any frame
- Annotate screenshots (arrows, labels, highlights)
- Create clozes from transcript or annotated images
- Review with optional video clip playback

### PDF Documents

Academic papers, textbooks, documentation.

- Native PDF rendering
- Highlight and extract passages
- Annotations preserved
- Page-level reading progress

### Notes & Markdown

Your own writing, imported notes, or synced from Obsidian.

- Full markdown support
- Wiki-style linking between notes
- Backlinks and references
- Compatible with existing Obsidian vaults

## Screenshots & Annotations

Visual content deserves visual learning.

### Capture

- Screenshot any video frame
- Capture regions of PDFs
- Import images from clipboard

### Annotate

- Draw arrows pointing at key elements
- Add text labels and explanations
- Highlight or box important regions
- Blur/mask areas for image occlusion

### Image Occlusion

Hide parts of diagrams, reveal during review:

- Label anatomical diagrams
- Memorize maps and charts
- Learn visual processes step-by-step
- Quiz yourself on code structure

## Review Experience

### Smart Scheduling

The system uses FSRS (Free Spaced Repetition Scheduler) to optimize review timing:

- Reviews scheduled based on memory model
- Difficulty adjusts to your performance
- Minimal reviews for maximum retention
- Predicted retention shown for each item

### Review Modes

**Quick review** - Text-based, fast, works offline

**Rich review** - Includes images, video clips, full context

**Topic focus** - Review only items from specific sources or tags

### Progress & Stats

- Daily review forecast
- Retention statistics
- Learning streaks
- Time spent reading vs reviewing

## AI Integration

AI as a learning partner, not a replacement for thinking.

### Interleaved Quiz

Traditional reviews show one card, you answer, repeat. AI-powered interleaved quiz mixes things up:

- Questions drawn from multiple topics in one session
- AI generates varied question formats for the same knowledge
- Connections surfaced between seemingly unrelated items
- Harder to pattern-match, deeper encoding

Example session:

```
1. What enzyme breaks down starch? [Biology]
2. In what year did the French Revolution begin? [History]
3. How does starch digestion relate to the bread shortages of 1789? [Cross-topic]
```

The AI notices you're learning both topics and creates bridging questions.

### Question Generation

Beyond simple cloze deletions:

**From an extract:**

> "The mitochondria produces ATP through oxidative phosphorylation"

**AI generates:**

- Cloze: "The {{c1::mitochondria}} produces ATP..."
- Reversal: "What does the mitochondria produce?"
- Why: "Why is oxidative phosphorylation important?"
- Compare: "How does this differ from glycolysis?"
- Apply: "What happens to ATP production during exercise?"

One extract becomes multiple learning angles.

### Understanding Checks

Periodically, the AI probes deeper:

- "You've reviewed this 10 times. Can you explain it in your own words?"
- "How does this connect to [other topic you're learning]?"
- "What would happen if [variable changed]?"

Catches illusion of competence - knowing the answer without understanding.

### Socratic Mode

Stuck on something? Enter a dialogue:

```
You: I don't understand why mitochondria are important
AI: What do you know about energy in cells?
You: Cells need energy to function
AI: Right. Where do you think that energy comes from?
You: Food somehow?
AI: Exactly. Now, what do you think converts food into usable energy?
```

Guides you to understanding rather than giving answers.

### Auto-Extraction Suggestions

While reading, AI suggests what to extract:

- Highlights key definitions
- Identifies important facts
- Suggests cloze candidates
- Notices what you might be missing

You decide what to keep - AI just points things out.

### Difficulty Calibration

AI adjusts question difficulty based on your performance:

- Struggling? Simpler variations, more hints
- Mastering? Harder applications, edge cases
- Bored? Novel angles, connections to new topics

### Privacy-First AI

Your learning data is sensitive:

- Local models available (Ollama, llama.cpp)
- Cloud AI optional, not required
- Your data never used for training
- Full functionality offline

### AI Tutor

A personal tutor that knows what you're learning.

**Explain concepts:**

- "Explain this like I'm a beginner"
- "I know X, how does Y relate?"
- "What's the intuition behind this?"

**Answer questions:**

- Ask anything about your materials
- AI references your actual extracts and sources
- "According to lecture 3, the process works by..."

**Guided practice:**

- "Quiz me on chapter 5"
- "I have 10 minutes, what should I focus on?"
- "Prepare me for tomorrow's exam on topic X"

**Track understanding:**

- Notices gaps in your knowledge
- Suggests what to review or read next
- "You seem solid on A and B, but C might need work"

### Collections & Courses

Group related materials into structured learning paths.

**What's a collection:**

```
MIT 6.006 Algorithms
├── Lecture Videos (24)
├── Lecture Notes (PDF)
├── Problem Sets
├── Course Objectives
└── My Extracts (147)
```

A collection bundles everything for a topic - videos, readings, notes, objectives - into one place.

**Import course materials:**

- YouTube playlist → all lectures imported
- PDF syllabus → parsed into objectives
- Lecture slides → extracted key points
- Your notes → linked to source materials

**Course objectives as anchors:**

- Import learning objectives from syllabus
- Track progress against each objective
- AI maps your extracts to objectives
- See gaps: "No extracts covering objective 7"

### Queries Across Collections

Ask questions that span your materials:

**Find connections:**

- "What do my algorithms and ML courses say about graphs?"
- "Show me everything about memory from psychology and neuroscience"
- "Where do these two courses overlap?"

**Synthesize knowledge:**

- "Summarize what I've learned about sorting algorithms"
- "Compare the approaches in lecture 3 vs the textbook"
- "What are the key takeaways from this collection?"

**With references:**

```
You: What's the time complexity of quicksort?

AI: O(n log n) average case, O(n²) worst case.

References:
- Lecture 4 [12:34]: "Quicksort averages n log n..."
- Your extract from CLRS Ch. 7: "Worst case occurs when..."
- Problem Set 2, Q3: You solved this correctly on 2024-01-15
```

Every answer points back to your materials.

### Learning Paths

AI helps structure your learning journey:

**Prerequisite mapping:**

- "Before learning X, you should understand Y"
- Suggests order for tackling materials
- Identifies gaps in foundational knowledge

**Adaptive pacing:**

- "You're ready to move on from basics"
- "Might want to revisit fundamentals before continuing"
- Adjusts based on your review performance

**Goal-oriented:**

- "I want to understand distributed systems"
- AI creates a reading/viewing plan
- Tracks progress toward your goal

## Canvas Integration

Visual organization of your learning.

### Knowledge Maps

- Drag extracts onto a spatial canvas
- Draw connections between concepts
- Group related ideas visually
- See the big picture of a topic

### Reading Queues

- Visual reading backlog
- Prioritize by dragging
- See progress at a glance

### Spaced Repetition Visualization

- Items positioned by due date
- Clusters show related reviews
- Visual memory palace potential

## Cross-Platform

### Mac App (Primary)

Native-feeling Mac application for serious reading sessions.

- Full reading and review experience
- Video support with screenshots
- Annotation tools
- Keyboard-driven workflow
- Menu bar quick review

### Mobile (iOS, Android)

Review anywhere, light reading on the go.

- Optimized for quick review sessions
- Offline access to all content
- Swipe-based rating
- Capture ideas on mobile

### Web App

Access from any device with a browser.

- Full reading and review experience
- No installation required
- Works offline (PWA)

### Obsidian Plugin

For users who want incremental reading within Obsidian.

- Uses Obsidian as the editor
- Extracts stored as regular notes
- Review pane within Obsidian
- Syncs with other platforms

## Sync

Seamless continuity across all devices.

### What Syncs

- Reading progress
- Extracts and clozes
- Review history and scheduling
- Annotations and screenshots
- Canvas layouts

### How It Works

- Changes sync automatically when online
- Full offline support (sync when connected)
- Conflict-free (review history merges cleanly)
- End-to-end encryption option

### Your Data

- Export everything anytime
- Standard formats (markdown, JSON)
- No vendor lock-in
- Self-host option available

## Editor Experience

Not trying to replace Obsidian or Notion. Just enough editing for learning.

### Reading Focus

- Clean, distraction-free reading view
- Comfortable typography
- Dark mode
- Adjustable text size and width

### Quick Edits

- Fix typos in extracts
- Add notes to items
- Restructure clozes

### Linking

- Link between extracts
- Reference source material
- Build knowledge connections

## SuperMemo-Inspired Features

Drawing from decades of spaced repetition research.

### Priority Queue

Not just due dates - items ranked by:

- Importance (user-set priority)
- Forgetting probability
- Topic balance
- Time available

### Incremental Processing

Large articles don't need to be processed in one sitting:

- Mark reading position
- Extract as you go
- Return later automatically
- Gradual refinement of extracts

### Knowledge Trees

Extracts maintain connection to sources:

- See where an extract came from
- Navigate up to broader context
- Drill down into details
- Trace learning history

### Auto-Postpone

Life happens:

- Overdue items don't pile up guilt
- Smart rescheduling when you're behind
- Priority-based triage
- Vacation mode

## Importers

### Anki

- Import existing Anki decks
- Preserve scheduling history
- Convert Anki cards to IR items

### Readwise

- Sync highlights automatically
- Convert to extracts
- Queue for processing

### Pocket / Instapaper

- Import saved articles
- Migrate reading list

### Browser History

- Revisit articles you've read
- Capture forgotten bookmarks

## The Long Game

### Year One

You've read and processed hundreds of articles. Thousands of extracts refined into knowledge. Daily reviews take 15 minutes but compound into expertise.

### Five Years

A personal knowledge base that remembers what you've learned. Connections between ideas across years of reading. Near-permanent retention of what matters.

### The Goal

**Learn anything. Remember everything. Understand deeply.**

Not through cramming or endless re-reading, but through the natural rhythm of incremental reading and spaced repetition.

---

_"The best time to plant a tree was 20 years ago. The second best time is now."_

Start reading. Start extracting. Start remembering.
