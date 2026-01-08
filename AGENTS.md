# Obsidian Incremental Reading Plugin

## Project Overview

This is an Obsidian plugin that implements SuperMemo-inspired incremental reading with extracts, cloze deletions, and FSRS-based spaced repetition.

**Key Documentation:**

- `docs/ARCHITECTURE.md` - Technical design, data model, and implementation status
- `docs/IMPLEMENTATION_SPEC.md` - Step-by-step implementation guide
- `docs/USER_GUIDE.md` - User-facing documentation
- `README.md` - Project overview, features, and installation

## Core Concepts

### Incremental Reading Workflow

1. **Extract** - Select text → create new note linked from source
2. **Cloze** - Wrap text in `{{c1::answer}}` for active recall
3. **Review** - Study due items with spaced repetition scheduling

### Data Model

- **Topics** - Extracts without clozes (passive review)
- **Items** - Cloze deletions (active recall with question/answer phases)
- **Sidecar files** - Per-note scheduling state in `IR/Review Items/<id>.md`
- **Revlog** - Review history in `IR/Revlog/YYYY-MM.md` (JSONL format)

### Key Architecture Decisions

- Plain Anki-style cloze syntax: `{{c1::text}}` (no HTML wrapper)
- Single-pane review: content rendered in review panel (no separate editor)
- Per-cloze scheduling via sidecar files
- FSRS algorithm for spaced repetition
- Race condition handling for concurrent file operations

## Source Structure

```
src/
├── core/           # Pure functions (testable, no Obsidian deps)
│   ├── types.ts    # Type definitions
│   ├── cloze.ts    # Cloze parsing and formatting
│   ├── queue.ts    # Queue building and ordering
│   ├── scheduling.ts # FSRS calculations
│   └── frontmatter.ts # Frontmatter parsing
│
├── data/           # Data access layer
│   ├── revlog.ts   # JSONL append/read
│   ├── review-items.ts # Sidecar file read/write
│   ├── sync.ts     # Note ↔ sidecar synchronization
│   └── ids.ts      # NanoID generation
│
├── commands/       # Obsidian commands
│   ├── extract.ts  # Extract to topic note
│   └── cloze.ts    # Cloze creation
│
├── views/          # UI components (Preact)
│   ├── review/
│   │   ├── ReviewItemView.tsx  # Main view controller
│   │   ├── ReviewScreen.tsx    # Review UI
│   │   └── DeckSummary.tsx     # Deck list UI
│   └── stats/
│       └── StatsModal.tsx
│
├── settings.ts     # Plugin settings
├── styles.css      # CSS styles
└── main.ts         # Plugin entry point
```

## Environment & Tooling

- **Node.js**: 20+ recommended
- **Package manager**: npm
- **Bundler**: esbuild
- **UI framework**: Preact (JSX)
- **Scheduling**: ts-fsrs

### Commands

```bash
npm install      # Install dependencies
npm run dev      # Development build (watch mode)
npm run build    # Production build
npm run lint     # Run ESLint
npm test         # Run tests
```

## Key Files to Understand

| File                                  | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `src/views/review/ReviewItemView.tsx` | Main review controller - handles queue, grading, content loading |
| `src/core/cloze.ts`                   | `formatClozeQuestion()` and `formatClozeAnswer()` for display    |
| `src/core/scheduling.ts`              | FSRS grading logic                                               |
| `src/data/sync.ts`                    | Syncs note content to sidecar files                              |
| `src/data/review-items.ts`            | Reads/writes sidecar scheduling state                            |

## Patterns Used

### Race Condition Handling

All file creation uses try/catch to handle concurrent operations:

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

### Phase Detection for Review

```typescript
// Topics skip question phase, cloze items show question first
const isClozeItem = item?.type === 'item' && item?.clozeIndex;
this.phase = isClozeItem ? 'question' : 'answer';
```

### Content Rendering

```typescript
// Load content with cloze formatting based on phase
const formatted =
	this.phase === 'question'
		? formatClozeQuestion(content, item.clozeIndex)
		: formatClozeAnswer(content, item.clozeIndex);
await MarkdownRenderer.render(app, formatted, container, notePath, this);
```

## Agent Guidelines

### Do

- Read `docs/ARCHITECTURE.md` for design decisions and data model
- Check `docs/IMPLEMENTATION_SPEC.md` for implementation status
- Use pure functions in `src/core/` for testable logic
- Handle file race conditions with try/catch pattern
- Keep UI components in Preact (not React)

### Don't

- Store scheduling data in note frontmatter (use sidecars)
- Open separate editor tabs during review (use single-pane design)
- Wrap clozes in HTML (use plain `{{c1::text}}` syntax)
- Commit `main.js`, `styles.css`, or `node_modules/`

## Testing

Manual install for testing:

```bash
npm run build
# Copy main.js, manifest.json, styles.css to:
# <Vault>/.obsidian/plugins/obsidian-incremental-reading/
```

Reload Obsidian and enable in **Settings → Community plugins**.

## Manifest Rules

- `id`: `obsidian-incremental-reading` (never change after release)
- `version`: Semantic versioning (x.y.z)
- Keep `minAppVersion` accurate when using newer APIs

## Releases

1. Bump version in `manifest.json`
2. Update `versions.json` to map plugin version → min app version
3. Create GitHub release with tag matching version (no `v` prefix)
4. Attach `main.js`, `manifest.json`, `styles.css`

## References

- Obsidian API: https://docs.obsidian.md
- FSRS Algorithm: https://github.com/open-spaced-repetition/fsrs4anki
- SuperMemo IR: https://supermemo.guru/wiki/Incremental_reading
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
