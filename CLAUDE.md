# Obsidian Incremental Reading Plugin

An Obsidian plugin implementing SuperMemo-inspired incremental reading with extracts, cloze deletions, and FSRS-based spaced repetition.

## Quick Reference

```bash
npm run dev          # Development build (watch mode)
npm run build        # Production build (includes typecheck)
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm test             # Run all tests with coverage
npm run format       # Format code with Prettier
```

### Targeted Testing

Run tests for a specific module with focused coverage:

```bash
npm run test -- src/engine --coverage.include src/engine
```

## Architecture

- **src/core/** - Pure, testable business logic (no Obsidian dependencies)
- **src/data/** - Data access layer (sidecar files, revlog)
- **src/ui/** - Preact UI components (use Preact, NOT React)
- **src/engine/** - Review scheduling engine
- **src/commands/** - Obsidian commands (extract, cloze)

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
  await app.vault.create(path, content);
} catch {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    await app.vault.append(file, content);
  }
}
```

### Cloze Syntax

Use plain Anki-style syntax: `{{c1::answer}}` - no HTML wrappers.

## Don't

- Store scheduling data in note frontmatter
- Use React (use Preact instead)
- Wrap clozes in HTML
- Commit `main.js`, `styles.css`, or `node_modules/`
- Open separate editor tabs during review (single-pane design)

## Documentation

- `docs/ARCHITECTURE.md` - Technical design and data model
- `docs/IMPLEMENTATION_SPEC.md` - Implementation guide
- `AGENTS.md` - Detailed agent guidelines
