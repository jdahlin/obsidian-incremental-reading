---
name: ship
description: Fix tests, commit, create a PR, and ensure GitHub Actions pass. Use when asked to ship code, fix and push, or make sure CI passes. Iterates until all checks are green.
---

# Ship Code

Fix issues, commit, create a PR, and wait for CI to pass. Keep iterating until GitHub Actions are green.

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

### 3. Create Feature Branch

If on master/main, create a new branch:

```bash
git checkout -b <type>/<short-description>
```

Branch naming: `feat/add-feature`, `fix/bug-name`, `refactor/module-name`

### 4. Commit and Push

Use conventional commit format:

```bash
git add -A && git commit -m "<type>(<scope>): <description>"
git push -u origin HEAD
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### 5. Create Pull Request

Create a PR using the gh CLI:

```bash
gh pr create --fill
```

Or with explicit title/body:
```bash
gh pr create --title "<type>(<scope>): <description>" --body "Description of changes"
```

### 6. Monitor PR Checks

Watch the PR checks until completion:

```bash
gh pr checks --watch
```

Or monitor the workflow run directly:
```bash
gh run list --limit 1 --json databaseId --jq '.[0].databaseId' | xargs gh run watch --exit-status
```

### 7. Handle CI Failures

If CI fails, get the failure details and fix:

```bash
gh run view --log-failed
```

Then fix locally, re-run checks, commit, push, and monitor again:

```bash
npm run typecheck && npm run lint && npm test
git add -A && git commit -m "fix: <describe fix>" && git push
gh pr checks --watch
```

Repeat until CI is green.

## gh Commands

| Command | Purpose |
|---------|---------|
| `gh pr create --fill` | Create PR with auto-filled title/body |
| `gh pr create --title "..." --body "..."` | Create PR with explicit content |
| `gh pr checks --watch` | Watch PR checks until completion |
| `gh pr view` | View PR details |
| `gh pr view --web` | Open PR in browser |
| `gh run list --limit 1` | Check latest CI run status |
| `gh run watch <run-id> --exit-status` | Watch CI run until completion |
| `gh run view --log-failed` | Get failed step logs |

## Success Criteria

- All local checks pass (typecheck, lint, test)
- PR is created successfully
- `gh pr checks` shows all checks passed
