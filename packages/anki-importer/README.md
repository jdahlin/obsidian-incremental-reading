# @anthropic/anki-importer

Import Anki collections into Obsidian Incremental Reading vault format.

## Overview

This package reads an Anki SQLite database (`collection.anki2`) and exports its contents to markdown files that integrate seamlessly with the IR plugin's review system.

## Installation

```bash
pnpm add @anthropic/anki-importer
```

## Usage

### CLI

The easiest way to import is via the CLI:

```bash
# Import from default Anki location
pnpm run cli --import --vault ./my-vault

# Import from custom Anki profile
pnpm run cli --import --vault ./my-vault --import-path ~/Library/Application\ Support/Anki2/Profile

# Filter decks (not yet implemented)
pnpm run cli --import --vault ./my-vault --deck-filter "Spanish*"
```

### Programmatic API

```typescript
import {
	importAnkiDatabase,
	writeAnkiData,
	openAnkiDatabase,
	getCollectionCreationTime,
} from '@anthropic/anki-importer'
import { join } from 'node:path'

// 1. Import data from Anki database
const ankiDbPath = '/path/to/collection.anki2'
const data = importAnkiDatabase(ankiDbPath)

console.log(`Found ${data.stats.noteCount} notes, ${data.stats.cardCount} cards`)

// 2. Get collection creation time for scheduling conversion
const db = openAnkiDatabase(ankiDbPath)
const collectionCreatedAt = getCollectionCreationTime(db)
db.close()

// 3. Write to vault
const result = await writeAnkiData(data, {
	outputDir: '/path/to/vault/Anki', // Notes go here
	sidecarDir: '/path/to/vault/IR/Review Items', // Sidecars go here
	vaultRelativePrefix: 'Anki', // For note_path in sidecars
	mediaDir: '/path/to/collection.media', // Optional: copy media
	collectionCreatedAt,
})

console.log(`Wrote ${result.notesWritten} notes, ${result.cardsWritten} sidecars`)
```

## Output Structure

```
Vault/
├── Anki/
│   ├── Default/
│   │   └── 1234567890.md       # Note file
│   ├── Spanish::Verbs/
│   │   └── 9876543210.md       # Nested deck → nested folder
│   ├── _Models/
│   │   ├── Basic.md            # Model definitions
│   │   └── Cloze.md
│   └── _Media/
│       └── image.jpg           # Copied media files
└── IR/
    └── Review Items/
        ├── ABC123def456.md     # Sidecar with scheduling state
        └── XYZ789ghi012.md
```

## File Formats

### Note File

```yaml
---
ir_note_id: ABC123def456
anki_note_id: "1234567890123"
anki_model_id: "9876543210"
tags: [spanish, verbs]
created: 2024-01-15
type: cloze
priority: 50
cloze: [c1, c2]
---

## Front

La palabra {{c1::hola}} significa {{c2::hello}}.

## Back

Additional context here.
```

### Sidecar File (Scheduling)

```yaml
---
ir_note_id: ABC123def456
note_path: Anki/Spanish/1234567890.md
anki_note_id: '1234567890123'
type: cloze
priority: 50
clozes:
    c1:
        cloze_uid: xyz789abc123
        status: review
        due: 2024-01-20T10:00:00.000Z
        stability: 14.5
        difficulty: 4.2
        reps: 10
        lapses: 1
        last_review: 2024-01-15T10:00:00.000Z
    c2:
        cloze_uid: def456ghi789
        status: new
        due: 2024-01-15T00:00:00.000Z
        stability: 0
        difficulty: 5
        reps: 0
        lapses: 0
        last_review: null
---
```

## Supported Card Types

| Anki Type       | IR Type           | Detection                  |
| --------------- | ----------------- | -------------------------- |
| Basic           | `basic`           | Has Front/Back fields      |
| Cloze           | `cloze`           | Model kind is Cloze        |
| Image Occlusion | `image_occlusion` | Has Image/Occlusion fields |
| Other           | `basic`           | Fallback                   |

## Scheduling Conversion

Anki's scheduling state is converted to FSRS-compatible format:

| Anki     | IR           | Formula                                    |
| -------- | ------------ | ------------------------------------------ |
| `queue`  | `status`     | 0→new, 1→learning, 2→review, 3→relearning  |
| `due`    | `due`        | Days from epoch → ISO 8601 datetime        |
| `ivl`    | `stability`  | Interval in days used as initial stability |
| `factor` | `difficulty` | `(3000 - clamp(factor, 1300, 3000)) / 170` |
| `reps`   | `reps`       | Direct copy                                |
| `lapses` | `lapses`     | Direct copy                                |

Suspended cards (`queue = -1`) are skipped entirely.

## API Reference

### `importAnkiDatabase(dbPath: string): AnkiImportResult`

Reads an Anki database and returns parsed data.

### `writeAnkiData(data: AnkiImportResult, options: WriteOptions): Promise<WriteResult>`

Writes imported data to markdown files.

**Options:**

- `outputDir` - Absolute path for note files (e.g., `/vault/Anki`)
- `sidecarDir` - Absolute path for sidecars (e.g., `/vault/IR/Review Items`)
- `vaultRelativePrefix` - Prefix for `note_path` in sidecars (e.g., `"Anki"`)
- `mediaDir` - Optional path to `collection.media` folder
- `collectionCreatedAt` - Unix timestamp for due date calculation

### `openAnkiDatabase(dbPath: string): Database`

Opens an Anki database with read-only access.

### `getCollectionCreationTime(db: Database): number`

Returns the collection creation timestamp in seconds.

## Architecture

The importer follows the IR plugin's sidecar architecture:

1. **Notes** contain content (fields converted to markdown sections)
2. **Sidecars** contain scheduling state, stored in `IR/Review Items/`
3. **`note_path`** in each sidecar links it to its note file

This ensures imported Anki cards appear in the same review queue as native IR content.

## Development

```bash
# Run tests
pnpm --filter @anthropic/anki-importer test

# Type check
pnpm --filter @anthropic/anki-importer typecheck

# Build
pnpm --filter @anthropic/anki-importer build
```

## Database Schema

The importer supports Anki schema v18 (normalized tables):

```sql
-- Note types
notetypes(id, name, config)
fields(ntid, ord, name, config)
templates(ntid, ord, name, config)

-- Content
notes(id, guid, mid, mod, tags, flds)
cards(id, nid, did, ord, queue, type, due, ivl, factor, reps, lapses)

-- Structure
decks(id, name, config)
```

## Limitations

- Media files are copied but not processed (no re-encoding)
- Review history (revlog) is not imported
- Custom scheduling data in card configs is ignored
- Deck options/presets are not preserved
