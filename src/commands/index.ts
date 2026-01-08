import type IncrementalReadingPlugin from '../main';
import { clozeSelectionNextIndex, clozeSelectionSameIndex } from './cloze';
import { extractToIncrementalNote } from './extract';
import { Notice } from 'obsidian';
import { exportReviewHistory } from '../data/export';
import { normalizeNumber } from '../core/frontmatter';
import { PriorityModal } from '../ui/PriorityModal';
import { StatsModal } from '../views/stats/StatsModal';

export function registerCommands(plugin: IncrementalReadingPlugin): void {
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
			const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
			const current = normalizeNumber(frontmatter?.priority, 50);

			new PriorityModal(plugin.app, current, (newPriority) => {
				void (async () => {
					await plugin.app.fileManager.processFrontMatter(file, (fm) => {
						const data = fm as Record<string, unknown>;
						data.priority = newPriority;
					});
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
		editorCallback: async (editor, view) => {
			await extractToIncrementalNote(plugin.app, editor, view, {
				titleWords: plugin.settings.extractTitleWords,
				tag: plugin.settings.extractTag,
			});
		},
	});

	plugin.addCommand({
		id: 'cloze-selection',
		name: 'Cloze selection',
		editorCallback: async (editor, view) => {
			await clozeSelectionNextIndex(plugin.app, editor, view.file, {
				extractTag: plugin.settings.extractTag,
			});
		},
	});

	plugin.addCommand({
		id: 'cloze-selection-same-index',
		name: 'Cloze selection (same index)',
		editorCallback: async (editor, view) => {
			await clozeSelectionSameIndex(plugin.app, editor, view.file, {
				extractTag: plugin.settings.extractTag,
			});
		},
	});
}
