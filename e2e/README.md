# E2E Tests for Obsidian Incremental Reading

Automated end-to-end tests using [Playwright](https://playwright.dev/) with Obsidian's Electron app.

## Prerequisites

- Node.js 18+
- macOS (Intel or Apple Silicon)
- ~500MB disk space for Obsidian download

## Setup

```bash
# Install dependencies (includes Playwright)
npm install

# Download and extract Obsidian (cached in e2e/.cache/)
npm run e2e:setup
```

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with visible browser window
npm run test:e2e:headed

# Run specific test file
npx playwright test -c e2e/playwright.config.ts e2e/tests/workflow.spec.ts

# Debug mode (step through tests)
npx playwright test -c e2e/playwright.config.ts --debug
```

## Test Structure

```
e2e/
├── .cache/                  # Downloaded Obsidian (gitignored)
├── fixtures/
│   └── obsidian.fixture.ts  # Playwright fixtures for Obsidian
├── setup/
│   ├── obsidian.ts          # Obsidian download/launch utilities
│   └── vault.ts             # Test vault creation utilities
├── tests/
│   └── workflow.spec.ts     # Core workflow tests
├── playwright.config.ts
└── README.md
```

## How It Works

1. **Vault Setup**: Each test gets a fresh vault with the plugin installed
2. **Obsidian Launch**: Playwright launches Obsidian as an Electron app
3. **Test Execution**: Tests interact with Obsidian via DOM selectors and keyboard
4. **Cleanup**: Test vaults are deleted after each test

## Writing Tests

```typescript
import { test, expect, ObsidianPage } from '../fixtures/obsidian.fixture';

test('my test', async ({ window, vault, createNote }) => {
	const obsidian = new ObsidianPage(window);

	// Wait for plugin to load
	await obsidian.waitForPlugin();

	// Create a test note
	await createNote('Test Note', '# Hello\n\nContent here');

	// Open the note
	await obsidian.openFile('Test Note');

	// Run a command
	await obsidian.runCommand('Incremental Reading: Extract');

	// Assert something
	expect(await window.locator('.some-element').isVisible()).toBe(true);
});
```

## Fixtures Available

- `vault` - VaultConfig with path to test vault
- `obsidian` - ElectronApplication instance
- `window` - Main Playwright Page for Obsidian
- `createNote(name, content, folder?)` - Helper to create notes

## ObsidianPage Helpers

- `openFile(name)` - Open file via quick switcher
- `runCommand(name)` - Execute command palette command
- `selectText(text)` - Select text in editor
- `getEditorContent()` - Get current editor content
- `waitForPlugin()` - Wait for IR plugin to load
- `openReviewView()` - Open the review sidebar

## CI Integration

The tests can run in CI with a virtual framebuffer:

```yaml
- name: Run E2E tests
  run: xvfb-run npm run test:e2e
```

## Troubleshooting

### Tests timeout waiting for Obsidian

- Increase timeout in `playwright.config.ts`
- Check if Obsidian downloaded correctly in `e2e/.cache/`
- Try running with `--headed` to see what's happening

### Plugin not loading

- Ensure `npm run build` completed successfully
- Check that `main.js` exists in project root
- Verify `manifest.json` has correct plugin ID

### Selectors not found

- Obsidian's DOM structure may change between versions
- Use `--debug` mode to inspect elements
- Update selectors in `obsidian.fixture.ts`
