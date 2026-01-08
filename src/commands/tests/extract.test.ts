import { describe, expect, it } from 'vitest';
import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import {
	extractToIncrementalNote,
	escapeMarkdownLinkText,
	sanitizeTitle,
	titleFromSelection,
} from '../extract';
import { formatDate } from '../../core/frontmatter';

function getFrontmatter(app: App, path: string): Record<string, unknown> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return {};
	return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

describe('extract helpers', () => {
	it('builds titles from selections', () => {
		expect(titleFromSelection('one two three', 2)).toBe('one two');
		expect(titleFromSelection('   ', 2)).toBe('Extract');
	});

	it('sanitizes titles', () => {
		expect(sanitizeTitle('a/b:c?d*e')).toBe('abcde');
	});

	it('escapes markdown link text', () => {
		expect(escapeMarkdownLinkText('a]b')).toBe('a\\]b');
		expect(escapeMarkdownLinkText('a\n b')).toBe('a  b');
	});
});

describe('extractToIncrementalNote', () => {
	it('shows notices when selection or file is missing', async () => {
		const app = new App();
		const emptyEditor = new Editor('   ');
		const view = new MarkdownView(null);
		Notice.clear();

		await extractToIncrementalNote(app, emptyEditor, view, { titleWords: 2 });
		expect(Notice.messages).toContain('No selection to extract.');

		const editor = new Editor('Text');
		Notice.clear();
		await extractToIncrementalNote(app, editor, view, { titleWords: 2 });
		expect(Notice.messages).toContain('No active file.');
	});

	it('creates a child note, link, and sidecar', async () => {
		const app = new App();
		const source = await app.vault.create('Folder/Source Note.md', 'Source content');
		const view = new MarkdownView(source);
		const selection = 'Line one\r\nLine two';
		const editor = new Editor(selection);
		Notice.clear();

		const now = new Date('2024-01-02T03:04:05');
		await extractToIncrementalNote(app, editor, view, {
			titleWords: 2,
			tag: '#topic',
			now,
			priority: 80,
		});

		const childPath = 'Folder/Line one.md';
		const childFile = app.vault.getAbstractFileByPath(childPath);
		expect(childFile).not.toBeNull();

		const frontmatter = getFrontmatter(app, childPath);
		expect(frontmatter.tags).toEqual(['topic']);
		expect(frontmatter.type).toBe('topic');
		expect(frontmatter.source).toBe('[[Folder/Source Note]]');
		expect(frontmatter.priority).toBe(80);
		const created =
			frontmatter.created instanceof Date
				? formatDate(frontmatter.created)
				: String(frontmatter.created);
		expect(created).toBe(formatDate(now));
		expect(frontmatter.ir_note_id).toBeTruthy();

		const linkText = '[Line one Line two](Folder/Line%20one.md)';
		expect(editor.getValue()).toBe(linkText);
		expect(Notice.messages.some((msg) => msg.includes('Created note: Line one'))).toBe(true);

		const noteId = frontmatter.ir_note_id as string;
		const sidecarPath = `IR/Review Items/${noteId}.md`;
		expect(app.vault.getAbstractFileByPath(sidecarPath)).not.toBeNull();
	});
});
