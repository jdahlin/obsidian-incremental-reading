import { describe, expect, it } from 'vitest';
import { App, Editor, MarkdownFileInfo, MarkdownView } from 'obsidian';
import { registerCommands } from '..';

type CommandPlugin = Parameters<typeof registerCommands>[0];

type TestCommand = {
	id: string;
	name: string;
	callback?: () => void;
	checkCallback?: (checking: boolean) => boolean;
	editorCallback?: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => Promise<void>;
};

function isTestCommand(value: unknown): value is TestCommand {
	if (!value || typeof value !== 'object') return false;
	const record = value as { id?: unknown; name?: unknown };
	return typeof record.id === 'string' && typeof record.name === 'string';
}

function makePlugin(app: App): CommandPlugin & { commands: TestCommand[] } {
	const commands: TestCommand[] = [];
	return {
		app,
		settings: {
			newCardsPerDay: 10,
			maximumInterval: 365,
			requestRetention: 0.9,
			extractTag: 'topic',
			extractTitleWords: 2,
			createFolderForExtractedTopics: false,
			trackReviewTime: true,
			showStreak: true,
			queueStrategy: 'JD1' as const,
			clumpLimit: 3,
			cooldown: 5,
		},
		commands,
		addCommand(command: unknown): void {
			if (!isTestCommand(command)) {
				throw new Error('Unexpected command shape.');
			}
			commands.push(command);
		},
		activateReviewView: async (): Promise<void> => {},
	};
}

describe('registerCommands', () => {
	it('registers command metadata', () => {
		const app = new App();
		const plugin = makePlugin(app);

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
		const plugin = makePlugin(app);
		registerCommands(plugin);

		const source = await app.vault.create('Folder/Source.md', 'Alpha Beta Gamma');
		const editor = new Editor('Alpha Beta');
		const view = new MarkdownView(source);

		const command = plugin.commands.find((entry) => entry.id === 'extract-to-incremental-note');
		if (!command?.editorCallback) {
			throw new Error('Missing extract command.');
		}
		await command.editorCallback(editor, view);

		const child = app.vault.getAbstractFileByPath('Folder/Alpha Beta.md');
		expect(child).not.toBeNull();
	});
});
