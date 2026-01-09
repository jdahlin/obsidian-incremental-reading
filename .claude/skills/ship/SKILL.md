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

### 2. Fix Any Failures

If checks fail:
- **TypeScript errors**: Fix type issues in the reported files
- **Lint errors**: Run `npm run format` for formatting, manually fix logic issues
- **Test failures**: Read the test file, understand the assertion, fix the code or test

Re-run checks after each fix until all pass locally.

### 3. Commit and Push

Use conventional commit format and push:

```bash
git add -A && git commit -m "<type>(<scope>): <description>" && git push
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### 4. Monitor CI with gh

After pushing, immediately check CI status:

```bash
gh run list --limit 1
```

If status is "in_progress", watch until completion:

```bash
gh run watch
```

### 5. Handle CI Failures

If CI fails, get the failure details and fix:

```bash
gh run view --log-failed
```

Then fix locally, re-run checks, commit, push, and monitor again:

```bash
npm run typecheck && npm run lint && npm test
git add -A && git commit -m "fix: <describe fix>" && git push
gh run watch
```

Repeat until CI is green.

## gh Commands

| Command | Purpose |
|---------|---------|
| `gh run list --limit 1` | Check latest CI run status |
| `gh run watch` | Watch CI run until completion |
| `gh run view --log-failed` | Get failed step logs |
| `gh pr create --fill` | Create PR from current branch |
| `gh pr view --web` | Open PR in browser |
| `gh pr checks` | View PR check status |

## Success Criteria

- All local checks pass (typecheck, lint, test)
- `git push` succeeds
- `gh run list --limit 1` shows status "completed" with conclusion "success"
