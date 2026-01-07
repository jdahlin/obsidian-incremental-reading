import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';

export type ExtractOptions = {
	titleWords: number;
	tag?: string;
	now?: Date;
};

export async function extractToIncrementalNote(
	plugin: Plugin,
	editor: Editor,
	view: MarkdownView,
	options: ExtractOptions = { titleWords: 5 },
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
	const created = formatDate(createdAt);
	const sourceFolder = sourceFile.parent?.path ?? '';
	const sourceLink = buildSourceLink(sourceFolder, sourceFile.basename);

	// Create child note next to the source note.
	const childBasename = titleFromSelection(selection, options.titleWords);
	const childPathBase = sourceFolder ? `${sourceFolder}/${childBasename}.md` : `${childBasename}.md`;
	const childPath = await getAvailablePath(plugin, childPathBase);

	const createdBasename = childPath.split('/').pop()?.replace(/\.md$/i, '') ?? childBasename;

	const tag = normalizeTag(options.tag) || 'topic';
	const childFrontmatter = buildExtractFrontmatter(sourceLink, tag, created);

	const childContent = [childFrontmatter, selection].join('\n');

	await plugin.app.vault.create(childPath, childContent);

	// Parent update: wrap the selection in a standard Markdown link.
	const from = editor.getCursor('from');
	const linkedText = escapeMarkdownLinkText(selectionRaw);
	const linkTarget = encodeURI(childPath);

	editor.replaceSelection(`[${linkedText}](${linkTarget})`);
	editor.setSelection(from, editor.getCursor('to'));

	new Notice(`Created note: ${createdBasename}`);
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

function buildExtractFrontmatter(sourceLink: string, tag: string, created: string): string {
	// Keep frontmatter minimal so defaults are derived during review.
	return [
		'---',
		`source: "${sourceLink}"`,
		`tags: [${tag}]`,
		`created: ${created}`,
		'---',
	].join('\n');
}

export function escapeMarkdownLinkText(text: string): string {
	// Escape characters that break markdown link text.
	// We keep it minimal: escape ] and newlines (collapse to spaces) so the link stays one-line.
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\n/g, ' ')
		.split(']')
		.join('\\]')
		.trim();
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
	// Obsidian filenames can't contain: / \\ : | ? * " < >
	return title
		.replace(/[\\/:|?*"<>]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 120);
}

async function getAvailablePath(plugin: Plugin, desiredPath: string): Promise<string> {
	const ext = '.md';
	const hasExt = desiredPath.toLowerCase().endsWith(ext);
	const path = hasExt ? desiredPath : `${desiredPath}${ext}`;

	if (!plugin.app.vault.getAbstractFileByPath(path)) return path;

	const stem = path.slice(0, -ext.length);
	let i = 2;
	while (plugin.app.vault.getAbstractFileByPath(`${stem} ${i}${ext}`)) i++;
	return `${stem} ${i}${ext}`;
}

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
