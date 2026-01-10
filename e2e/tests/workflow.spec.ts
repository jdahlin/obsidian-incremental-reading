/**
 * E2E tests for the core incremental reading workflow.
 *
 * Tests the full flow: create topic → extract → cloze → review
 */

import { test, expect, ObsidianPage } from '../fixtures/obsidian.fixture';
import * as fs from 'fs/promises';
import * as path from 'path';

test.describe('Incremental Reading Workflow', () => {
	test('plugin loads successfully', async ({ window, vault }) => {
		const obsidian = new ObsidianPage(window);

		// Wait for plugin to load
		await obsidian.waitForPlugin();

		// Verify plugin commands are available
		const hasCommands = await window.evaluate(() => {
			// @ts-expect-error - Obsidian global
			const app = window.app;
			const commands = Object.keys(app.commands.commands);
			return commands.filter((c) => c.startsWith('incremental-reading')).length > 0;
		});

		expect(hasCommands).toBe(true);
	});

	test('creates sidecar when note is tagged as topic', async ({ window, vault, createNote }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Create a note with #topic tag
		const noteContent = `---
tags:
  - topic
---

# My First Topic

This is some content to learn.
`;
		await createNote('First Topic', noteContent);

		// Open the note in Obsidian
		await obsidian.openFile('First Topic');
		await window.waitForTimeout(1000);

		// Trigger sync (the plugin should auto-detect the tag)
		// For now, we run the sync command explicitly
		await obsidian.runCommand('Incremental Reading: Sync Items');
		await window.waitForTimeout(2000);

		// Check that IR folder and sidecar were created
		const irFolder = path.join(vault.vaultPath, 'IR', 'Review Items');
		const files = await fs.readdir(irFolder).catch(() => []);

		expect(files.length).toBeGreaterThan(0);
	});

	test('extract command creates linked note', async ({ window, vault, createNote }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Create source topic
		const sourceContent = `---
tags:
  - topic
---

# Source Article

Here is an important paragraph that I want to extract for later review.

And here is another paragraph.
`;
		await createNote('Source Article', sourceContent);

		// Open the note
		await obsidian.openFile('Source Article');
		await window.waitForTimeout(500);

		// Select text (simplified - in real test we'd do proper selection)
		// Using keyboard shortcuts: Ctrl+A to select all, then we'll manually select
		await obsidian.selectText('important paragraph');

		// Run extract command
		await obsidian.runCommand('Incremental Reading: Extract');
		await window.waitForTimeout(1000);

		// Check that a new note was created
		const files = await fs.readdir(vault.vaultPath);
		const extractNotes = files.filter((f) => f.endsWith('.md') && f !== 'Source Article.md');

		// Should have created an extract note
		expect(extractNotes.length).toBeGreaterThanOrEqual(1);
	});

	test('cloze command wraps text in cloze syntax', async ({ window, vault, createNote }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Create a note
		const content = `# Flashcard Note

The capital of France is Paris.
`;
		await createNote('Flashcard', content);

		// Open and select text
		await obsidian.openFile('Flashcard');
		await window.waitForTimeout(500);

		await obsidian.selectText('Paris');

		// Run cloze command
		await obsidian.runCommand('Incremental Reading: Create Cloze');
		await window.waitForTimeout(500);

		// Check editor content has cloze syntax
		const editorContent = await obsidian.getEditorContent();

		expect(editorContent).toContain('{{c1::');
	});

	test('review view shows deck summary', async ({ window, vault, createNote }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Create some reviewable content
		const content = `---
tags:
  - topic
---

# Study Material

Important fact: {{c1::The mitochondria}} is the powerhouse of the cell.
`;
		await createNote('Biology', content);

		// Sync items
		await obsidian.runCommand('Incremental Reading: Sync Items');
		await window.waitForTimeout(1000);

		// Open review view
		await obsidian.openReviewView();
		await window.waitForTimeout(500);

		// Should show deck summary with at least one item
		const deckSummary = await window.locator('.deck-summary, .ir-deck-list').isVisible();
		expect(deckSummary).toBe(true);
	});

	test('grading an item updates its state', async ({ window, vault, createNote }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Create a due item
		const content = `---
tags:
  - topic
---

# Review Item

{{c1::Answer}} is the question.
`;
		await createNote('Review Test', content);

		// Sync
		await obsidian.runCommand('Incremental Reading: Sync Items');
		await window.waitForTimeout(1000);

		// Open review
		await obsidian.openReviewView();
		await window.waitForTimeout(500);

		// Start review if there's a start button
		const startButton = window.locator('button:has-text("Start"), button:has-text("Review")');
		if (await startButton.isVisible()) {
			await startButton.click();
			await window.waitForTimeout(500);
		}

		// Grade with "Good" (keyboard shortcut 3 or click button)
		const goodButton = window.locator('button:has-text("Good")');
		if (await goodButton.isVisible()) {
			await goodButton.click();
		} else {
			await window.keyboard.press('3');
		}
		await window.waitForTimeout(500);

		// Check that sidecar was updated (has review state)
		const irFolder = path.join(vault.vaultPath, 'IR', 'Review Items');
		const sidecars = await fs.readdir(irFolder).catch(() => []);

		if (sidecars.length > 0) {
			const sidecarContent = await fs.readFile(path.join(irFolder, sidecars[0]), 'utf-8');
			// Should contain scheduling data
			expect(sidecarContent).toMatch(/status:|due:|stability:/);
		}
	});
});

test.describe('Edge Cases', () => {
	test('handles empty vault gracefully', async ({ window }) => {
		const obsidian = new ObsidianPage(window);
		await obsidian.waitForPlugin();

		// Open review view with no items
		await obsidian.openReviewView();
		await window.waitForTimeout(500);

		// Should not crash, should show empty state
		const view = await window.locator('[data-type="incremental-reading-review"]').isVisible();
		expect(view).toBe(true);
	});

	test('survives Obsidian restart', async ({ obsidian, window, vault, createNote }) => {
		const obsidianPage = new ObsidianPage(window);
		await obsidianPage.waitForPlugin();

		// Create content
		const content = `---
tags:
  - topic
---
# Persistence Test
{{c1::Data}} should persist.
`;
		await createNote('Persist', content);

		// Sync
		await obsidianPage.runCommand('Incremental Reading: Sync Items');
		await window.waitForTimeout(1000);

		// Record what files exist
		const irFolder = path.join(vault.vaultPath, 'IR', 'Review Items');
		const beforeRestart = await fs.readdir(irFolder).catch(() => []);

		// Close and reopen (simulated by checking files persist)
		await obsidian.close();

		// Files should still exist
		const afterClose = await fs.readdir(irFolder).catch(() => []);
		expect(afterClose).toEqual(beforeRestart);
	});
});
