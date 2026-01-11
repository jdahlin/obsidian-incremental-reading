# Obsidian Incremental Reading Plugin

## Project Overview

This is a monorepo for an Obsidian plugin that implements SuperMemo-inspired incremental reading with extracts, cloze deletions, and FSRS-based spaced repetition. It includes a CLI for terminal-based review.

**Key Documentation:**

- `docs/ARCHITECTURE.md` - Technical design, data model, and implementation status
- `docs/IMPLEMENTATION_SPEC.md` - Step-by-step implementation guide
- `docs/USER_GUIDE.md` - User-facing documentation
- `README.md` - Project overview, features, and installation

## Core Concepts

### Incremental Reading Workflow

1. **Extract** - Select text -> create new note linked from source
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

## Monorepo Structure

```
packages/
├── core/           # @repo/core - Pure business logic (no Obsidian deps)
│   └── src/
│       ├── anki/       # Anki import/export, deck parsing
│       ├── core/       # Core types, cloze parsing, frontmatter
│       ├── data/       # Data access abstractions
│       ├── rv/         # Random variable utilities
│       ├── scheduling/ # FSRS calculations
│       ├── stats/      # Statistics calculations
│       ├── strategies/ # Card selection strategies
│       └── SessionManager.ts  # Review session orchestration
│
├── obsidian/       # @repo/obsidian - Obsidian plugin
│   └── src/
│       ├── adapters/   # Platform adapters (file system, etc.)
│       ├── bases/      # Base classes for views
│       ├── commands/   # Obsidian commands (extract, cloze)
│       ├── data/       # File-based data access (sync, review-items)
│       ├── editor/     # CodeMirror extensions
│       ├── review/     # Review UI components (Preact)
│       ├── stats/      # Statistics modal
│       ├── settings.ts # Plugin settings
│       └── main.ts     # Plugin entry point
│
├── cli/            # @repo/cli - Terminal review client
│   └── src/
│       ├── screens/    # Terminal UI screens
│       ├── components/ # Reusable Ink components
│       └── App.tsx     # Main CLI application (React/Ink)
│
configs/            # Shared configurations
├── eslint/         # @repo/eslint-config
├── ts/             # @repo/tsconfig
└── vitest/         # @repo/vitest-config
```

## Environment & Tooling

- **Node.js**: 25+ required
- **Package manager**: pnpm 10+
- **Build orchestration**: Turborepo
- **Bundler**: esbuild (for Obsidian plugin)
- **UI framework**: Preact (Obsidian), React/Ink (CLI)
- **Scheduling**: ts-fsrs

### Commands

```bash
pnpm install                       # Install dependencies
pnpm run dev                       # Development build (watch mode, all packages)
pnpm run build                     # Production build
pnpm run lint                      # Run ESLint
pnpm test                          # Run tests
pnpm run typecheck                 # TypeScript type checking
pnpm run format                    # Format with Prettier

# Per-package commands
pnpm --filter @repo/core test      # Run tests for core only
pnpm --filter @repo/obsidian dev   # Dev mode for obsidian plugin
pnpm run cli                       # Run CLI directly
```

## Key Files to Understand

| File                                            | Purpose                                           |
| ----------------------------------------------- | ------------------------------------------------- |
| `packages/core/src/SessionManager.ts`           | Review session orchestration and queue management |
| `packages/core/src/core/cloze.ts`               | `formatClozeQuestion()` and `formatClozeAnswer()` |
| `packages/core/src/scheduling/FSRSScheduler.ts` | FSRS grading logic                                |
| `packages/obsidian/src/data/sync.ts`            | Syncs note content to sidecar files               |
| `packages/obsidian/src/data/review-items.ts`    | Reads/writes sidecar scheduling state             |
| `packages/obsidian/src/review/ReviewRoot.tsx`   | Main review UI component                          |

## Patterns Used

### Race Condition Handling

All file creation uses try/catch to handle concurrent operations:

```typescript
try {
	await app.vault.create(path, content)
} catch {
	const file = app.vault.getAbstractFileByPath(path)
	if (file instanceof TFile) {
		await app.vault.append(file, content)
	}
}
```

### Phase Detection for Review

```typescript
// Topics skip question phase, cloze items show question first
const isClozeItem = item?.type === 'item' && item?.clozeIndex
this.phase = isClozeItem ? 'question' : 'answer'
```

### Content Rendering

```typescript
// Load content with cloze formatting based on phase
const formatted =
	this.phase === 'question'
		? formatClozeQuestion(content, item.clozeIndex)
		: formatClozeAnswer(content, item.clozeIndex)
await MarkdownRenderer.render(app, formatted, container, notePath, this)
```

### Test Directory Convention

Use `tests/` for test directories, not `__tests__/`:

```
packages/core/src/anki/
├── converter.ts
├── html.ts
└── tests/
    ├── converter.test.ts
    └── html.test.ts
```

## Agent Guidelines

### Do

- Read `docs/ARCHITECTURE.md` for design decisions and data model
- Check `docs/IMPLEMENTATION_SPEC.md` for implementation status
- Use pure functions in `packages/core/` for testable logic
- Handle file race conditions with try/catch pattern
- Use Preact in Obsidian plugin, React/Ink in CLI
- Run `pnpm --filter <package> test` for package-specific testing

### Don't

- Store scheduling data in note frontmatter (use sidecars)
- Open separate editor tabs during review (use single-pane design)
- Wrap clozes in HTML (use plain `{{c1::text}}` syntax)
- Commit `main.js`, `styles.css`, or `node_modules/`
- Use React in the Obsidian plugin (use Preact)
- Use `__tests__/` directories (use `tests/`)

## Testing

### Running Tests

```bash
pnpm test                          # All tests
pnpm --filter @repo/core test      # Core package only
pnpm --filter @repo/obsidian test  # Obsidian package only
```

### Manual Plugin Testing

```bash
pnpm run build
# Copy main.js, manifest.json, styles.css to:
# <Vault>/.obsidian/plugins/obsidian-incremental-reading/
```

Reload Obsidian and enable in **Settings -> Community plugins**.

## Manifest Rules

- `id`: `obsidian-incremental-reading` (never change after release)
- `version`: Semantic versioning (x.y.z)
- Keep `minAppVersion` accurate when using newer APIs

## Releases

1. Bump version in `manifest.json`
2. Update `versions.json` to map plugin version -> min app version
3. Create GitHub release with tag matching version (no `v` prefix)
4. Attach `main.js`, `manifest.json`, `styles.css`

## References

- Obsidian API: https://docs.obsidian.md
- FSRS Algorithm: https://github.com/open-spaced-repetition/fsrs4anki
- SuperMemo IR: https://supermemo.guru/wiki/Incremental_reading
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Turborepo: https://turbo.build/repo/docs
