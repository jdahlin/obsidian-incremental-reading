import { describe, expect, it } from 'vitest';
import { App, Editor, MarkdownView } from 'obsidian';
import type IncrementalReadingPlugin from '../../src/main';
import { registerCommands } from '../../src/commands';

function makePlugin(app: App): IncrementalReadingPlugin {
	return {
		app,
		settings: {
			newCardsPerDay: 10,
			maximumInterval: 365,
			requestRetention: 0.9,
			extractTag: 'topic',
			extractTitleWords: 2,
			trackReviewTime: true,
			showStreak: true,
		},
		commands: [],
		addCommand(command: unknown): void {
			(this.commands as unknown[]).push(command);
		},
	} as IncrementalReadingPlugin & { commands: unknown[] };
}

describe('registerCommands', () => {
	it('registers command metadata', () => {
		const app = new App();
		const plugin = makePlugin(app) as IncrementalReadingPlugin & {
			commands: { id: string; name: string }[];
		};

		registerCommands(plugin);
		const ids = plugin.commands.map((command) => command.id).sort();
		expect(ids).toEqual([
			'cloze-selection',
			'cloze-selection-same-index',
			'export-review-history',
			'extract-to-incremental-note',
			'open-review-view',
			'open-statistics',
			'set-priority',
		]);
	});

	it('invokes the extract command with plugin settings', async () => {
		const app = new App();
		const plugin = makePlugin(app) as IncrementalReadingPlugin & {
			commands: {
				id: string;
				editorCallback: (editor: Editor, view: MarkdownView) => Promise<void>;
			}[];
		};
		registerCommands(plugin);

		const source = await app.vault.create('Folder/Source.md', 'Alpha Beta Gamma');
		const editor = new Editor('Alpha Beta');
		const view = new MarkdownView(source);

		const command = plugin.commands.find((entry) => entry.id === 'extract-to-incremental-note');
		await command?.editorCallback(editor, view);

		const child = app.vault.getAbstractFileByPath('Folder/Alpha Beta.md');
		expect(child).not.toBeNull();
	});
});
