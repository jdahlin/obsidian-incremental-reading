/**
 * Playwright test fixtures for Obsidian E2E testing.
 *
 * Provides a fresh vault and Obsidian instance for each test.
 */

import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import { createTestVault, cleanupVault, createNote, type VaultConfig } from '../setup/vault';
import { getPlaywrightConfig } from '../setup/obsidian';

export interface ObsidianFixtures {
	vault: VaultConfig;
	obsidian: ElectronApplication;
	window: Page;
	createNote: (name: string, content: string, folder?: string) => Promise<string>;
}

export const test = base.extend<ObsidianFixtures>({
	// Create a fresh test vault for each test
	vault: async ({}, use) => {
		const tempDir = path.join(os.tmpdir(), 'obsidian-ir-e2e');
		const vault = await createTestVault(tempDir);

		await use(vault);

		// Cleanup after test
		await cleanupVault(vault.vaultPath);
	},

	// Launch Obsidian with the test vault
	obsidian: async ({ vault }, use) => {
		const config = await getPlaywrightConfig(vault.vaultPath);

		const app = await _electron.launch({
			executablePath: config.executablePath,
			args: config.args,
			env: config.env as Record<string, string>,
		});

		await use(app);

		await app.close();
	},

	// Get the main window
	window: async ({ obsidian }, use) => {
		// Wait for the first window to appear
		const window = await obsidian.firstWindow();

		// Wait for Obsidian to fully load
		await window.waitForLoadState('domcontentloaded');

		// Wait for the workspace to be ready (Obsidian-specific)
		await window.waitForSelector('.workspace', { timeout: 30_000 });

		await use(window);
	},

	// Helper to create notes in the test vault
	createNote: async ({ vault }, use) => {
		const helper = async (name: string, content: string, folder?: string) => {
			return createNote(vault.vaultPath, name, content, folder);
		};
		await use(helper);
	},
});

export { expect } from '@playwright/test';

/**
 * Page object helpers for common Obsidian interactions.
 */
export class ObsidianPage {
	constructor(private page: Page) {}

	/**
	 * Open a file in Obsidian using the quick switcher.
	 */
	async openFile(name: string): Promise<void> {
		// Open quick switcher with Cmd/Ctrl+O
		await this.page.keyboard.press('Meta+o');
		await this.page.waitForSelector('.prompt', { timeout: 5000 });

		// Type the filename and press Enter
		await this.page.fill('.prompt-input', name);
		await this.page.waitForTimeout(300); // Wait for search results
		await this.page.keyboard.press('Enter');

		// Wait for the file to open
		await this.page.waitForTimeout(500);
	}

	/**
	 * Open the command palette.
	 */
	async openCommandPalette(): Promise<void> {
		await this.page.keyboard.press('Meta+p');
		await this.page.waitForSelector('.prompt', { timeout: 5000 });
	}

	/**
	 * Run a command from the command palette.
	 */
	async runCommand(command: string): Promise<void> {
		await this.openCommandPalette();
		await this.page.fill('.prompt-input', command);
		await this.page.waitForTimeout(300);
		await this.page.keyboard.press('Enter');
	}

	/**
	 * Select text in the current editor.
	 */
	async selectText(text: string): Promise<void> {
		// Use Cmd+F to find, then select
		await this.page.keyboard.press('Meta+f');
		await this.page.waitForSelector('.search-input-container', { timeout: 5000 });
		await this.page.fill('.search-input-container input', text);
		await this.page.keyboard.press('Escape');

		// The found text should now be selected
		// For more precise selection, we'd need to use the editor API
	}

	/**
	 * Get the current editor content.
	 */
	async getEditorContent(): Promise<string> {
		// This uses CodeMirror's internal structure
		const content = await this.page.evaluate(() => {
			const editor = document.querySelector('.cm-content');
			return editor?.textContent ?? '';
		});
		return content;
	}

	/**
	 * Wait for the IR plugin to be loaded.
	 */
	async waitForPlugin(): Promise<void> {
		// Check that the plugin's commands are registered
		await this.page.waitForFunction(
			() => {
				// @ts-expect-error - Obsidian global
				const app = window.app;
				if (!app?.commands?.commands) return false;
				return Object.keys(app.commands.commands).some((id) =>
					id.startsWith('incremental-reading'),
				);
			},
			{ timeout: 10_000 },
		);
	}

	/**
	 * Open the IR Review view.
	 */
	async openReviewView(): Promise<void> {
		await this.runCommand('Incremental Reading: Open Review');
		// Wait for the review view to appear
		await this.page.waitForSelector('[data-type="incremental-reading-review"]', {
			timeout: 5000,
		});
	}
}
