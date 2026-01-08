import { App, Editor, MarkdownFileInfo, MarkdownView, Notice, stringifyYaml } from 'obsidian';
import { formatDate } from '../core/frontmatter';
import { syncNoteToSidecar } from '../data/sync';

export interface ExtractOptions {
	titleWords: number;
	tag?: string;
	now?: Date;
	priority?: number;
}

export async function extractToIncrementalNote(
	app: App,
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo,
	options: ExtractOptions,
): Promise<void> {
	const selectionRaw = editor.getSelection();
	const selection = normalizeSelection(selectionRaw);
	if (!selection) {
		new Notice('No selection to extract.');
		return;
	}

	const sourceFile = view.file;
	if (!sourceFile) {
		new Notice('No active file.');
		return;
	}

	const createdAt = options.now ?? new Date();
	const sourceFolder = sourceFile.parent?.path ?? '';
	const sourceLink = buildSourceLink(sourceFolder, sourceFile.basename);
	const titleWords = options.titleWords ?? 5;
	const childBasename = titleFromSelection(selection, titleWords);
	const childPathBase = sourceFolder
		? `${sourceFolder}/${childBasename}.md`
		: `${childBasename}.md`;
	const childPath = await getAvailablePath(app, childPathBase);
	const tag = normalizeTag(options.tag) || 'topic';
	const priority = options.priority ?? 50;

	const frontmatter = {
		source: sourceLink,
		tags: [tag],
		type: 'topic',
		created: formatDate(createdAt),
		priority,
	};

	const childContent = ['---', stringifyYaml(frontmatter).trim(), '---', selection, ''].join(
		'\n',
	);
	const childFile = await app.vault.create(childPath, childContent);

	const from = editor.getCursor('from');
	const linkedText = escapeMarkdownLinkText(selectionRaw);
	const linkTarget = encodeURI(childPath);
	editor.replaceSelection(`[${linkedText}](${linkTarget})`);
	editor.setSelection(from, editor.getCursor('to'));

	await syncNoteToSidecar(app, childFile, tag);
	new Notice(`Created note: ${childFile.basename}`);
}

function normalizeSelection(selection: string): string {
	return selection.replace(/\r\n/g, '\n').trim();
}

function normalizeTag(tag: string | undefined): string {
	if (!tag) return '';
	return tag.trim().replace(/^#/, '');
}

function buildSourceLink(folderPath: string, basename: string): string {
	return folderPath ? `[[${folderPath}/${basename}]]` : `[[${basename}]]`;
}

export function escapeMarkdownLinkText(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\n/g, ' ').split(']').join('\\]').trim();
}

export function titleFromSelection(selection: string, maxWords: number): string {
	const words = selection
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean)
		.slice(0, maxWords);

	const raw = words.join(' ') || 'Extract';
	return sanitizeTitle(raw);
}

export function sanitizeTitle(title: string): string {
	return title
		.replace(/[\\/:|?*"<>]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 120);
}

async function getAvailablePath(app: App, desiredPath: string): Promise<string> {
	const ext = '.md';
	const hasExt = desiredPath.toLowerCase().endsWith(ext);
	const path = hasExt ? desiredPath : `${desiredPath}${ext}`;

	if (!app.vault.getAbstractFileByPath(path)) return path;

	const stem = path.slice(0, -ext.length);
	let i = 2;
	while (app.vault.getAbstractFileByPath(`${stem} ${i}${ext}`)) i += 1;
	return `${stem} ${i}${ext}`;
}
