---
name: ship
description: Fix tests, commit, push, and ensure GitHub Actions pass. Use when asked to ship code, fix and push, or make sure CI passes. Iterates until all checks are green.
---

# Ship Code

Fix issues, commit, push, and wait for CI to pass. Keep iterating until GitHub Actions are green.

## Workflow

### 1. Run Local Checks First

Before pushing, run all checks locally to catch issues early:

```bash
npm run typecheck && npm run lint && npm test
```

For targeted testing on a specific module:

```bash
npm run test -- src/engine --coverage.include src/engine
```

### 2. Fix Any Failures

If checks fail:
- **TypeScript errors**: Fix type issues in the reported files
- **Lint errors**: Run `npm run format` for formatting, manually fix logic issues
- **Test failures**: Read the test file, understand the assertion, fix the code or test

Re-run checks after each fix until all pass locally.

### 3. Commit Changes

Use conventional commit format:

```bash
git add -A
git commit -m "<type>(<scope>): <description>"
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
Scopes: `core`, `ui`, `data`, `commands`, `engine`, `editor`, `settings`

### 4. Push to Remote

```bash
git push
```

### 5. Wait for GitHub Actions

Check the CI status:

```bash
gh run list --limit 1
```

Watch a specific run:

```bash
gh run watch
```

If the run is still in progress, wait and check again.

### 6. If CI Fails, Fix and Repeat

If GitHub Actions fail:

1. Get the failure details:
   ```bash
   gh run view --log-failed
   ```

2. Identify the failing step and error

3. Fix the issue locally

4. Run local checks again: `npm run typecheck && npm run lint && npm test`

5. Commit the fix:
   ```bash
   git add -A
   git commit -m "fix: <describe what was fixed>"
   ```

6. Push and wait for CI again:
   ```bash
   git push
   gh run watch
   ```

7. Repeat until CI is green

## Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint code quality |
| `npm test` | Run all tests with coverage |
| `npm run test -- <path> --coverage.include <path>` | Targeted tests |
| `npm run format` | Auto-fix formatting |
| `npm run build` | Production build |
| `gh run list --limit 1` | Check latest CI run status |
| `gh run watch` | Watch CI run in real-time |
| `gh run view --log-failed` | Get failed step logs |

## Don't Stop Until

- All local checks pass (typecheck, lint, test)
- Git push succeeds
- GitHub Actions workflow shows green checkmark

Keep iterating through the fix → commit → push → check cycle until everything passes.
