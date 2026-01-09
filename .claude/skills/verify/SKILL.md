---
name: verify
description: Run all verification checks for this project including typecheck, lint, tests, and build. Use when verifying code changes, before committing, or when asked to check if the code is working.
allowed-tools:
  - Bash
  - Read
---

# Verify Obsidian Incremental Reading Plugin

Run all verification checks to ensure code quality and correctness.

## Verification Steps

Run these commands in order. If any step fails, stop and report the error.

### 1. TypeScript Type Checking

```bash
npm run typecheck
```

This runs TypeScript compiler on both the main source and test files without emitting output.

### 2. ESLint Code Quality

```bash
npm run lint
```

Checks for code style issues and potential bugs.

### 3. Run Tests

```bash
npm test
```

Runs Vitest with coverage. All tests must pass.

#### Targeted Testing

To run tests for a specific directory with focused coverage:

```bash
npm run test -- src/engine --coverage.include src/engine
```

This is useful when working on a specific module to get faster feedback and focused coverage reports.

### 4. Production Build

```bash
npm run build
```

Builds the plugin for production. This also runs typecheck first.

## Quick Verification (All at Once)

For a quick pass/fail check:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Common Issues

### TypeScript Errors
- Check imports are correct
- Verify types match between modules
- Ensure Obsidian API types are up to date

### Lint Errors
- Run `npm run format` to auto-fix formatting issues
- Manual fixes needed for logic-related lint errors

### Test Failures
- Tests are in `src/**/tests/*.test.ts`
- Obsidian API is stubbed in `src/tests/obsidian-stub.ts`
- Check test output for specific failure details

### Build Failures
- Usually caused by TypeScript errors
- Check esbuild.config.mjs for build configuration
