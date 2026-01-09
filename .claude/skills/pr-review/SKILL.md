---
name: pr-review
description: Review pull requests for this Obsidian plugin. Use when reviewing PRs, code changes, or when asked to review code quality and adherence to project patterns.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
---

# PR Review for Obsidian Incremental Reading Plugin

Review pull requests against the project's established patterns and conventions.

## Review Checklist

### Architecture & Patterns

1. **Sidecar file pattern**: Scheduling data must go in `IR/Review Items/` sidecar files, NOT in note frontmatter
2. **Pure functions**: Business logic should be in `src/core/` as pure, testable functions
3. **Race condition handling**: File creation must use try/catch pattern:
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
4. **Cloze syntax**: Use plain `{{c1::text}}` syntax, no HTML wrappers
5. **Single-pane review**: Content renders in review panel, no separate editor tabs

### UI Framework

- Use **Preact** (not React) for UI components
- Components go in `src/ui/` directory
- Use `.tsx` extension for JSX files

### Code Quality

1. Run `npm run typecheck` - no TypeScript errors
2. Run `npm run lint` - no ESLint errors
3. Run `npm test` - all tests pass
4. Check for proper error handling
5. Verify no console.log statements left in production code

### Files That Should NOT Be Committed

- `main.js` (build output)
- `styles.css` (build output, except the source in src/)
- `node_modules/`
- `.env` or credential files

### Obsidian Plugin Guidelines

- `manifest.json` id must remain `obsidian-incremental-reading`
- Version follows semantic versioning (x.y.z)
- Check `minAppVersion` if using newer Obsidian APIs

## Review Process

1. Check the diff for the PR
2. Verify all checklist items above
3. Run verification commands: `npm run typecheck && npm run lint && npm test`
4. Provide specific feedback with file:line references
5. Suggest improvements following existing patterns

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/ui/review/ReviewItemView.tsx` | Main review controller |
| `src/core/cloze.ts` | Cloze formatting functions |
| `src/core/scheduling.ts` | FSRS grading logic |
| `src/data/sync.ts` | Note ↔ sidecar sync |
| `src/data/review-items.ts` | Sidecar state management |
