import { App, Editor, Notice, TFile } from 'obsidian';

export type ClozeOptions = {
	/** Optional label shown next to the cloze, default is "..." */
	title?: string;
	/** Cloze index for Anki-style syntax, defaults to 1 */
	index?: number;
	/** Tag used to mark cards */
	extractTag?: string;
};

let lastClozeIndex: number | null = null;

/**
 * Wrap the current selection in a cloze marker.
 *
 * Output format: {{c1::selected}} (plain Anki-style, no HTML wrapper)
 */
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

	// Plain Anki-style cloze syntax - no HTML wrapper
	const clozeText = `{{c${index}::${selectionRaw}}}`;

	editor.replaceSelection(clozeText);

	if (index > 0) {
		lastClozeIndex = index;
	}

	if (file) {
		const tag = options.extractTag?.trim() || 'topic';
		await convertToItem(app, file, tag);
	}
}

export function escapeHtmlText(value: string): string {
	// We want the literal cloze braces to render as text, not parsed HTML.
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function getNextClozeIndex(content: string): number {
	const matches = content.matchAll(/\{\{c(\d+)::/g);
	let max = 0;
	for (const match of matches) {
		const value = Number(match[1]);
		if (Number.isFinite(value)) max = Math.max(max, value);
	}
	return max + 1;
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

export function getHighestClozeIndex(content: string): number | null {
	const matches = content.matchAll(/\{\{c(\d+)::/g);
	let max = 0;
	for (const match of matches) {
		const value = Number(match[1]);
		if (Number.isFinite(value)) max = Math.max(max, value);
	}
	return max > 0 ? max : null;
}

async function convertToItem(app: App, file: TFile, extractTag: string): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		const tags = normalizeTags(fm.tags);
		if (!tags.includes(extractTag)) return;
		if (fm.type !== 'item') {
			fm.type = 'item';
		}
	});
}

function normalizeTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((tag) => String(tag).replace(/^#/, ''));
	}
	if (typeof value === 'string') {
		return value.split(/[,\s]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean);
	}
	return [];
}
