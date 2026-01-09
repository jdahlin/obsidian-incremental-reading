---
name: commit
description: Generate commit messages for this project following conventional commit format. Use when creating commits, writing commit messages, or when asked to commit changes.
allowed-tools:
  - Bash
  - Read
---

# Commit Messages for Obsidian Incremental Reading Plugin

Generate clear, conventional commit messages for this project.

## Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New features or functionality |
| `fix` | Bug fixes |
| `refactor` | Code changes that neither fix bugs nor add features |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `style` | Formatting, whitespace (no code logic change) |
| `perf` | Performance improvements |
| `chore` | Build process, dependencies, tooling |

### Scopes (Optional)

Use the module or area being changed:

- `core` - Pure business logic in src/core/
- `ui` - UI components in src/ui/
- `data` - Data access layer in src/data/
- `commands` - Obsidian commands
- `engine` - Review engine in src/engine/
- `editor` - CodeMirror extensions
- `settings` - Plugin settings

### Examples

```
feat(core): add support for multiple cloze indices per note

fix(ui): prevent review panel from closing on grade button click

refactor(data): extract sidecar file operations to separate module

test(core): add unit tests for cloze parsing edge cases

docs: update architecture documentation with new data model

chore: upgrade ts-fsrs to v5.2.3
```

## Before Committing

1. Run verification: `npm run typecheck && npm run lint && npm test`
2. Check what's staged: `git diff --staged`
3. Ensure no build outputs are staged (main.js, styles.css from root)

## Commit Process

1. Review staged changes with `git status` and `git diff --staged`
2. Determine the appropriate type and scope
3. Write a concise description (50 chars or less)
4. Add body if the change needs explanation
5. Create the commit

## Files to Never Commit

- `main.js` (build output)
- `styles.css` in root (build output)
- `node_modules/`
- `.env` or credential files
