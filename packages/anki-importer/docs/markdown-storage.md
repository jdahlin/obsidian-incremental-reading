# Markdown Storage Specification

This document defines the markdown file format and storage structure for imported Anki data.

---

## Table of Contents

- [Directory Structure](#directory-structure)
- [Model Files](#model-files)
- [Note Files](#note-files)
- [Sidecar Files](#sidecar-files)
- [Deck Files](#deck-files)
- [Field Separator](#field-separator)
- [Examples](#examples)

---

## Directory Structure

```
Vault/
├── IR/
│   ├── Anki-Import/
│   │   ├── Models/                    # Note type definitions
│   │   │   ├── Basic.md
│   │   │   ├── Cloze.md
│   │   │   └── Image Occlusion.md
│   │   └── Decks/                     # Deck hierarchy (optional)
│   │       └── deck-tree.md
│   └── Review Items/                  # Sidecar files (scheduling state)
│       ├── {ir_note_id}.md
│       └── ...
└── Anki/                              # Imported notes (mirrors deck hierarchy)
    └── {DeckPath}/
        └── {anki_note_id}.md
```

---

## Model Files

**Location:** `IR/Anki-Import/Models/{model_name}.md`

Model files define the structure of Anki note types. They are read-only reference files.

### Frontmatter Schema

```yaml
---
# Required fields
anki_model_id: string        # Anki notetype.id as string (e.g., "1234567890123")
name: string                 # Model name (e.g., "Basic", "Cloze")

# Field definitions (ordered)
fields:
  - name: string             # Field name (e.g., "Front", "Back")
    ord: number              # Field ordinal (0-indexed)

# Template definitions (ordered)
templates:
  - name: string             # Template name (e.g., "Card 1", "Card 2")
    ord: number              # Template ordinal (0-indexed)
    qfmt: string             # Question format (front template HTML)
    afmt: string             # Answer format (back template HTML)
---
```

### Body Format

Model files contain only frontmatter (no body content). All relevant information is in the YAML frontmatter.

### Filename Rules

- Use model name directly: `{name}.md`
- Replace filesystem-unsafe characters: `< > : " / \ | ? *` → `_`
- Preserve spaces and parentheses
- Example: `Basic (and reversed card).md`

---

## Note Files

**Location:** `Anki/{DeckPath}/{anki_note_id}.md`

Note files contain the actual card content, with fields as markdown sections.

### Frontmatter Schema

```yaml
---
# Required fields
ir_note_id: string           # Generated unique ID (12 chars, e.g., "H4573WdOw2q0")
anki_note_id: string         # Original Anki note.id as string
anki_model_id: string        # Reference to model → IR/Anki-Import/Models/

# Metadata
tags:
  - string                   # Tags from Anki (space-separated → array)
created: string              # ISO date when imported (YYYY-MM-DD)

# Card type hint (derived from model)
type: basic | cloze | image_occlusion | standard

# Priority for scheduling
priority: number             # Default: 50 (range 0-100)

# For cloze/image_occlusion: list of cloze indices
cloze:                       # Only present if type is cloze or image_occlusion
  - c1
  - c2
  - ...
---
```

### Body Format

Fields are stored as H2 sections in field order:

```markdown
## {Field 0 Name}

{Field 0 content as markdown}

## {Field 1 Name}

{Field 1 content as markdown}

## {Field N Name}

{Field N content as markdown}
```

### Field Content Conversion

| Anki HTML | Markdown |
|-----------|----------|
| `<b>text</b>`, `<strong>text</strong>` | `**text**` |
| `<i>text</i>`, `<em>text</em>` | `*text*` |
| `<u>text</u>` | `<u>text</u>` (preserved) |
| `<br>`, `<br/>` | newline |
| `<div>`, `</div>` | newline |
| `<img src="file.png">` | `![](file.png)` |
| `[sound:file.mp3]` | `[file.mp3](file.mp3)` |
| `{{c1::answer}}` | `{{c1::answer}}` (preserved) |
| `{{c1::answer::hint}}` | `{{c1::answer::hint}}` (preserved) |
| Other HTML | Strip tags, keep text |

### Deck Path Rules

- Anki deck hierarchy uses `::` separator
- Convert to filesystem path: `Parent::Child` → `Parent/Child`
- Example: `ANATOMIHISTO 2 Tenta::CNS::ÖGA` → `Anki/ANATOMIHISTO 2 Tenta/CNS/ÖGA/`

### Note Filename

- Use Anki note ID: `{anki_note_id}.md`
- Example: `1766406724605.md`

---

## Sidecar Files

**Location:** `IR/Review Items/{ir_note_id}.md`

Sidecar files store scheduling state separately from note content.

### Frontmatter Schema

```yaml
---
# Identity
ir_note_id: string           # Matches note's ir_note_id
note_path: string            # Relative path to note file

# Type (determines scheduling structure)
type: basic | cloze | image_occlusion | topic

# Priority
priority: number             # 0-100, affects queue order

# Scheduling state (structure depends on type)
# For basic cards:
basic:
  status: new | learning | review | relearning
  due: string                # ISO 8601 datetime
  stability: number          # FSRS stability (days)
  difficulty: number         # FSRS difficulty (0-10)
  reps: number               # Total reviews
  lapses: number             # Times forgotten
  last_review: string | null # ISO 8601 datetime or null

# For cloze/image_occlusion cards:
clozes:
  c1:
    cloze_uid: string        # Unique ID for this cloze card
    status: new | learning | review | relearning
    due: string
    stability: number
    difficulty: number
    reps: number
    lapses: number
    last_review: string | null
  c2:
    # ... same structure
  # ... more clozes

# For topic items:
topic:
  status: new | learning | review | relearning
  due: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  last_review: string | null
---
```

### Scheduling State Conversion (Anki → FSRS)

| Anki Field | FSRS Field | Conversion |
|------------|------------|------------|
| `queue` | `status` | See queue mapping below |
| `due` | `due` | Convert to ISO datetime |
| `ivl` | `stability` | Direct (days) |
| `factor` | `difficulty` | `(3000 - clamp(factor, 1300, 3000)) / 170` |
| `reps` | `reps` | Direct |
| `lapses` | `lapses` | Direct |

### Queue → Status Mapping

| Anki Queue | Status |
|------------|--------|
| 0 (new) | `new` |
| 1 (learning) | `learning` |
| 2 (review) | `review` |
| 3 (day learn) | `learning` |
| -1 (suspended) | Skip import |
| -2, -3 (buried) | `new` (reset) |

---

## Deck Files

**Location:** `IR/Anki-Import/Decks/deck-tree.md`

Optional file documenting the deck hierarchy.

### Frontmatter Schema

```yaml
---
generated: string            # ISO 8601 datetime
deck_count: number           # Total number of decks
---
```

### Body Format

```markdown
# Deck Hierarchy

- **Default** (id: 1)
  - **Subdeck A** (id: 1234567890123)
    - **Nested** (id: 1234567890124)
  - **Subdeck B** (id: 1234567890125)
```

---

## Field Separator

Anki stores all field values in a single `flds` column, separated by `\x1f` (U+001F, Unit Separator).

### Parsing

```typescript
const fieldValues = note.flds.split('\x1f')
// fieldValues[0] corresponds to fields.ord=0
// fieldValues[1] corresponds to fields.ord=1
// etc.
```

### Field Order

Field order is determined by the `fields.ord` column in the model definition. The `flds` string contains values in this order.

---

## Examples

### Example: Basic Model File

**File:** `IR/Anki-Import/Models/Basic.md`

```yaml
---
anki_model_id: "1234567890123"
name: Basic
fields:
  - name: Front
    ord: 0
  - name: Back
    ord: 1
templates:
  - name: Card 1
    ord: 0
    qfmt: "{{Front}}"
    afmt: |-
      {{FrontSide}}
      <hr id=answer>
      {{Back}}
---
```

### Example: Basic Note File

**File:** `Anki/My Deck/1766406724605.md`

```yaml
---
ir_note_id: H4573WdOw2q0
anki_note_id: "1766406724605"
anki_model_id: "1234567890123"
tags:
  - geography
  - europe
created: 2026-01-11
type: basic
priority: 50
---

## Front

What is the capital of France?

## Back

Paris
```

### Example: Cloze Model File

**File:** `IR/Anki-Import/Models/Cloze.md`

```yaml
---
anki_model_id: "1234567890124"
name: Cloze
fields:
  - name: Text
    ord: 0
  - name: Back Extra
    ord: 1
templates:
  - name: Cloze
    ord: 0
    qfmt: "{{cloze:Text}}"
    afmt: |-
      {{cloze:Text}}<br>
      <hr>
      {{Back Extra}}
---
```

### Example: Cloze Note File

**File:** `Anki/Languages/1766407231278.md`

```yaml
---
ir_note_id: K9xPqR2mN3b7
anki_note_id: "1766407231278"
anki_model_id: "1234567890124"
tags:
  - french
  - vocabulary
created: 2026-01-11
type: cloze
priority: 50
cloze:
  - c1
  - c2
---

## Text

The French word for "hello" is {{c1::bonjour}} and "goodbye" is {{c2::au revoir}}.

## Back Extra

Common French greetings.
```

### Example: Image Occlusion Model File

**File:** `IR/Anki-Import/Models/Image Occlusion.md`

```yaml
---
anki_model_id: "1234567890125"
name: Image Occlusion
fields:
  - name: Occlusion
    ord: 0
  - name: Image
    ord: 1
  - name: Header
    ord: 2
  - name: Back Extra
    ord: 3
  - name: Comments
    ord: 4
templates:
  - name: Image Occlusion
    ord: 0
    qfmt: |
      {{#Header}}<div>{{Header}}</div>{{/Header}}
      <div style="display: none">{{cloze:Occlusion}}</div>
      <div id="image-occlusion-container">
        {{Image}}
        <canvas id="image-occlusion-canvas"></canvas>
      </div>
      <script>
      try {
        anki.imageOcclusion.setup();
      } catch (exc) {
        document.getElementById("err").innerHTML = `Error: ${exc}`;
      }
      </script>
    afmt: |
      {{#Header}}<div>{{Header}}</div>{{/Header}}
      <div style="display: none">{{cloze:Occlusion}}</div>
      <div id="image-occlusion-container">
        {{Image}}
        <canvas id="image-occlusion-canvas"></canvas>
      </div>
      <script>anki.imageOcclusion.setup();</script>
      <div><button id="toggle">Toggle Masks</button></div>
      {{#Back Extra}}<div>{{Back Extra}}</div>{{/Back Extra}}
---
```

### Example: Image Occlusion Note File

**File:** `Anki/Anatomy/1766406724605.md`

```yaml
---
ir_note_id: M7nLpW4kQ9x2
anki_note_id: "1766406724605"
anki_model_id: "1234567890125"
tags:
  - anatomy
  - eye
created: 2026-01-11
type: image_occlusion
priority: 50
cloze:
  - c1
  - c2
  - c3
---

## Occlusion

{{c1::image-occlusion:rect:left=.66:top=.0225:width=.2871:height=.1474:oi=1}}
{{c2::image-occlusion:rect:left=.6655:top=.2191:width=.2926:height=.1675:oi=1}}
{{c3::image-occlusion:rect:left=.6683:top=.4447:width=.3242:height=.2145:oi=1}}

## Image

![](attachments/eye-anatomy.jpg)

## Header

Eye Anatomy

## Back Extra

Study the layers of the eye.

## Comments

From lecture slides.
```

### Example: Sidecar File (Cloze)

**File:** `IR/Review Items/K9xPqR2mN3b7.md`

```yaml
---
ir_note_id: K9xPqR2mN3b7
note_path: Anki/Languages/1766407231278.md
type: cloze
priority: 50
clozes:
  c1:
    cloze_uid: aB3xKp9mN2q7
    status: review
    due: "2026-01-15T00:00:00.000Z"
    stability: 4.5
    difficulty: 3.2
    reps: 5
    lapses: 0
    last_review: "2026-01-11T14:30:00.000Z"
  c2:
    cloze_uid: cD5yLr1nP4s8
    status: new
    due: "2026-01-01T00:00:00.000Z"
    stability: 0
    difficulty: 5
    reps: 0
    lapses: 0
    last_review: null
---
```
