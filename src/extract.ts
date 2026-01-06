import { Editor, MarkdownView, moment, Notice, Plugin } from 'obsidian';

export type ExtractOptions = {
	titleWords: number;
};

export async function extractToIncrementalNote(
	plugin: Plugin,
	editor: Editor,
	view: MarkdownView,
	options: ExtractOptions = { titleWords: 5 },
): Promise<void> {
	const selectionRaw = editor.getSelection();
	if (!selectionRaw.trim()) {
		new Notice('No selection to extract.');
		return;
	}

	const sourceFile = view.file;
	if (!sourceFile) {
		new Notice('No active file.');
		return;
	}

	// Normalize selection.
	const selection = selectionRaw.replace(/\r\n/g, '\n').trim();

	const created = moment().format('YYYY-MM-DDTHH:mm:ss');
	const sourceFolder = sourceFile.parent?.path ?? '';
	const sourceLink = sourceFolder ? `[[${sourceFolder}/${sourceFile.basename}]]` : `[[${sourceFile.basename}]]`;

	// Create child note next to the source note.
	const childBasename = titleFromSelection(selection, options.titleWords);
	const childPathBase = sourceFolder ? `${sourceFolder}/${childBasename}.md` : `${childBasename}.md`;
	const childPath = await getAvailablePath(plugin, childPathBase);

	const createdBasename = childPath.split('/').pop()?.replace(/\.md$/i, '') ?? childBasename;

	const childFrontmatter = [
		'---',
		`source: "${sourceLink}"`,
		`created: ${created}`,
		'tags: [extract]',
		'status: extract',
		'---',
	].join('\n');

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

function escapeMarkdownLinkText(text: string): string {
	// Escape characters that break markdown link text.
	// We keep it minimal: escape ] and newlines (collapse to spaces) so the link stays one-line.
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\n/g, ' ')
		.split(']')
		.join('\\]')
		.trim();
}

function titleFromSelection(selection: string, maxWords: number): string {
	const words = selection
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean)
		.slice(0, maxWords);

	const raw = words.join(' ') || 'Extract';
	return sanitizeTitle(raw);
}

function sanitizeTitle(title: string): string {
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
