import type IncrementalReadingPlugin from '../main';
import { clozeSelectionNextIndex, clozeSelectionSameIndex } from './cloze';
import { extractToIncrementalNote } from './extract';
import { Notice, type Editor, type MarkdownFileInfo, type MarkdownView } from 'obsidian';
import { exportReviewHistory } from '../data/export';
import { normalizeNumber } from '../core/frontmatter';
import { PriorityModal } from '../ui/PriorityModal';
import { StatsModal } from '../ui/stats/StatsModal';

type CommandPlugin = Pick<
	IncrementalReadingPlugin,
	'app' | 'settings' | 'addCommand' | 'activateReviewView'
>;

export function registerCommands(plugin: CommandPlugin): void {
	plugin.addCommand({
		id: 'open-review-view',
		name: 'Open review',
		callback: async () => {
			await plugin.activateReviewView();
		},
	});

	plugin.addCommand({
		id: 'set-priority',
		name: 'Set priority',
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;
			if (checking) return true;

			const cache = plugin.app.metadataCache.getFileCache(file);
			const rawFrontmatter = cache?.frontmatter as unknown;
			const current = normalizeNumber(
				isRecord(rawFrontmatter) ? rawFrontmatter.priority : undefined,
				50,
			);

			new PriorityModal(plugin.app, current, (newPriority) => {
				void (async () => {
					await plugin.app.fileManager.processFrontMatter(
						file,
						(fm: Record<string, unknown>) => {
							fm.priority = newPriority;
						},
					);
					new Notice(`Priority set to ${newPriority}.`);
				})();
			}).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'export-review-history',
		name: 'Export review history',
		callback: () => {
			void (async () => {
				const file = await exportReviewHistory(plugin.app);
				new Notice(`Exported review history to ${file.path}.`);
			})();
		},
	});

	plugin.addCommand({
		id: 'open-statistics',
		name: 'Open statistics',
		callback: () => {
			new StatsModal(plugin.app, plugin.settings.extractTag).open();
		},
	});

	plugin.addCommand({
		id: 'extract-to-incremental-note',
		name: 'Extract to topic note',
		editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
			await extractToIncrementalNote(plugin.app, editor, view, {
				titleWords: plugin.settings.extractTitleWords,
				tag: plugin.settings.extractTag,
				createFolderForExtractedTopics: plugin.settings.createFolderForExtractedTopics,
			});
		},
	});

	plugin.addCommand({
		id: 'cloze-selection',
		name: 'Cloze selection',
		editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
			await clozeSelectionNextIndex(plugin.app, editor, view.file, {
				extractTag: plugin.settings.extractTag,
			});
		},
	});

	plugin.addCommand({
		id: 'cloze-selection-same-index',
		name: 'Cloze selection (same index)',
		editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
			await clozeSelectionSameIndex(plugin.app, editor, view.file, {
				extractTag: plugin.settings.extractTag,
			});
		},
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
