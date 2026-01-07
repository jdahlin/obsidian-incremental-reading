import type IncrementalReadingPlugin from '../main';
import { clozeSelectionNextIndex, clozeSelectionSameIndex } from './cloze';
import { extractToIncrementalNote } from './extract';

export function registerCommands(plugin: IncrementalReadingPlugin): void {
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
