import { describe, expect, it } from 'vitest';
import { WorkspaceLeaf } from 'obsidian';
import IncrementalReadingPlugin from '../src/main';
import { VIEW_TYPE_REVIEW } from '../src/views/review/ReviewItemView';

function makeStoredSettings() {
	return {
		newCardsPerDay: 5,
		maximumInterval: 30,
		requestRetention: 0.85,
		extractTag: 'custom',
		extractTitleWords: 2,
		trackReviewTime: false,
		showStreak: false,
	};
}

describe('IncrementalReadingPlugin', () => {
	it('loads settings and registers features on load', async () => {
		const plugin = new IncrementalReadingPlugin();
		plugin.setData(makeStoredSettings());

		await plugin.onload();

		expect(plugin.settings.extractTag).toBe('custom');
		expect(plugin.settingTabs).toHaveLength(1);
		expect(plugin.editorExtensions).toHaveLength(1);
		expect(plugin.views.some((view) => view.type === VIEW_TYPE_REVIEW)).toBe(true);

		const commandIds = (plugin.commands as { id: string }[]).map((command) => command.id).sort();
		const expected = [
			'cloze-selection',
			'cloze-selection-same-index',
			'extract-to-incremental-note',
			'export-review-history',
			'open-review-view',
			'open-statistics',
			'set-priority',
		].sort();
		expect(commandIds).toEqual(expected);
	});

	it('activates the review view when requested', async () => {
		const plugin = new IncrementalReadingPlugin();
		const leaf = new WorkspaceLeaf();
		plugin.app.workspace.addLeaf(leaf);

		await (plugin as unknown as { activateReviewView: () => Promise<void> }).activateReviewView();
		expect(leaf.lastViewState?.type).toBe(VIEW_TYPE_REVIEW);
	});

	it('persists settings via saveSettings', async () => {
		const plugin = new IncrementalReadingPlugin();
		await plugin.onload();
		plugin.settings.extractTag = 'updated';
		await plugin.saveSettings();

		const stored = await plugin.loadData();
		expect((stored as { extractTag: string }).extractTag).toBe('updated');
	});
});
