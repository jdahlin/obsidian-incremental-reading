import { App, Editor, Notice, TFile } from 'obsidian';
import { getHighestClozeIndex, getNextClozeIndex } from '../core/cloze';
import { normalizeTags } from '../core/frontmatter';
import { syncNoteToSidecar } from '../data/sync';

export interface ClozeOptions {
	title?: string;
	index?: number;
	extractTag?: string;
}

let lastClozeIndex: number | null = null;

export async function clozeSelection(
	app: App,
	editor: Editor,
	file: TFile | null,
	options: ClozeOptions = {},
): Promise<void> {
	const selectionRaw = editor.getSelection();
	if (!selectionRaw.trim()) {
		new Notice('No selection to cloze.');
		return;
	}

	const index = options.index ?? 1;
	const clozeText = `{{c${index}::${selectionRaw}}}`;
	editor.replaceSelection(clozeText);

	if (index > 0) {
		lastClozeIndex = index;
	}

	if (file) {
		const tag = options.extractTag?.trim() || 'topic';
		await convertToItem(app, file, tag);
		await syncNoteToSidecar(app, file, tag);
	}
}

export async function clozeSelectionNextIndex(
	app: App,
	editor: Editor,
	file: TFile | null,
	options: Omit<ClozeOptions, 'index'> = {},
): Promise<void> {
	const index = getNextClozeIndex(editor.getValue());
	await clozeSelection(app, editor, file, { ...options, index });
}

export async function clozeSelectionSameIndex(
	app: App,
	editor: Editor,
	file: TFile | null,
	options: Omit<ClozeOptions, 'index'> = {},
): Promise<void> {
	const fallback = getHighestClozeIndex(editor.getValue());
	const index = lastClozeIndex ?? fallback ?? 1;
	await clozeSelection(app, editor, file, { ...options, index });
}

async function convertToItem(app: App, file: TFile, extractTag: string): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		const data = fm as { tags?: unknown; type?: unknown };
		const tags = normalizeTags(data.tags);
		if (!tags.includes(extractTag)) return;
		if (data.type !== "item") {
			data.type = "item";
		}
	});
}
