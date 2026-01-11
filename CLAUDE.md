# Obsidian Incremental Reading Plugin

A monorepo implementing SuperMemo-inspired incremental reading with extracts, cloze deletions, and FSRS-based spaced repetition.

## Quick Reference

```bash
pnpm install         # Install dependencies
pnpm run dev         # Development build (watch mode, all packages)
pnpm run build       # Production build (all packages)
pnpm run typecheck   # TypeScript type checking
pnpm run lint        # ESLint
pnpm test            # Run all tests with coverage
pnpm run format      # Format code with Prettier
```

### Per-Package Commands

```bash
pnpm --filter @repo/core test      # Run tests for core only
pnpm --filter @repo/obsidian dev   # Dev mode for obsidian plugin only
pnpm run cli                       # Run CLI directly
```

## Monorepo Structure

```
packages/
├── core/           # @repo/core - Pure business logic (no Obsidian deps)
│   └── src/
│       ├── anki/       # Anki import/export
│       ├── core/       # Core types and utilities
│       ├── data/       # Data access abstractions
│       ├── rv/         # Random variable utilities
│       ├── scheduling/ # FSRS scheduling
│       ├── stats/      # Statistics calculations
│       └── strategies/ # Card selection strategies
│
├── obsidian/       # @repo/obsidian - Obsidian plugin
│   └── src/
│       ├── adapters/   # Platform adapters
│       ├── commands/   # Obsidian commands (extract, cloze)
│       ├── data/       # File-based data access
│       ├── editor/     # CodeMirror extensions
│       ├── review/     # Review UI (Preact)
│       ├── stats/      # Stats UI
│       └── main.ts     # Plugin entry point
│
├── cli/            # @repo/cli - Terminal review client
│   └── src/
│       ├── screens/    # Terminal UI screens (React/Ink)
│       └── components/ # Reusable components
│
configs/            # Shared configurations
├── eslint/         # @repo/eslint-config
├── ts/             # @repo/tsconfig
└── vitest/         # @repo/vitest-config
```

## Key Patterns

### Sidecar Files (NOT Frontmatter)

Scheduling data goes in `IR/Review Items/` sidecar files, never in note frontmatter:

```
IR/
├── Review Items/    # Per-note scheduling state
└── Revlog/          # Review history (JSONL)
```

### Race Condition Handling

Always use try/catch for file creation:

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

### Cloze Syntax

Use plain Anki-style syntax: `{{c1::answer}}` - no HTML wrappers.

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

### UI Frameworks

- **Obsidian plugin**: Use Preact (NOT React)
- **CLI**: Use React with Ink

## Don't

- Store scheduling data in note frontmatter
- Use React in Obsidian (use Preact instead)
- Wrap clozes in HTML
- Commit `main.js`, `styles.css`, or `node_modules/`
- Open separate editor tabs during review (single-pane design)

## Debugging Review UI

Launch Obsidian with remote debugging:

```bash
open -a Obsidian --args --remote-debugging-port=9222
```

Use Chrome DevTools MCP to inspect the review view:

```javascript
document.querySelector('.ir-review-view')
```

## Documentation

- `docs/ARCHITECTURE.md` - Technical design and data model
- `docs/IMPLEMENTATION_SPEC.md` - Implementation guide
- `AGENTS.md` - Detailed agent guidelines
