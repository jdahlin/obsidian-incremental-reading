import { describe, expect, it } from 'vitest';
import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import {
	extractToIncrementalNote,
	escapeMarkdownLinkText,
	sanitizeTitle,
	titleFromSelection,
} from '../extract';
import { formatDate } from '../../engine/core/frontmatter';

function getFrontmatter(app: App, path: string): Record<string, unknown> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return {};
	return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

describe('Editor stub', () => {
	it('handles multi-line cursor positions', () => {
		const text = 'Line one\nLine two\nLine three';
		// Select "Line two" (starts at index 9, ends at index 17)
		const editor = new Editor(text, 9, 17);

		const from = editor.getCursor('from');
		expect(from).toEqual({ line: 1, ch: 0 });

		const to = editor.getCursor('to');
		expect(to).toEqual({ line: 1, ch: 8 });

		// Set selection to line 3
		editor.setSelection({ line: 2, ch: 0 }, { line: 2, ch: 10 });
		expect(editor.getSelection()).toBe('Line three');
	});
});

describe('Vault stub edge cases', () => {
	it('handles files in root folder', async () => {
		const app = new App();
		const file = await app.vault.create('root-file.md', 'content');
		expect(file.path).toBe('root-file.md');
		expect(file.parent).toBeNull();
	});

	it('handles files without extension', async () => {
		const app = new App();
		const file = await app.vault.create('Folder/noext', 'content');
		expect(file.extension).toBe('');
		expect(file.basename).toBe('noext');
	});

	it('renameFile handles files without extension', async () => {
		const app = new App();
		const file = await app.vault.create('Folder/noext', 'content');
		await app.fileManager.renameFile(file, 'Folder2/noext2');
		expect(file.extension).toBe('');
		expect(file.basename).toBe('noext2');
		expect(app.vault.getAbstractFileByPath('Folder/noext')).toBeNull();
		expect(app.vault.getAbstractFileByPath('Folder2/noext2')).toBe(file);
	});

	it('adapter.remove deletes files', async () => {
		const app = new App();
		await app.vault.create('test.md', 'content');
		expect(await app.vault.adapter.exists('test.md')).toBe(true);
		await app.vault.adapter.remove('test.md');
		expect(await app.vault.adapter.exists('test.md')).toBe(false);
	});

	it('createFolder handles root folder', async () => {
		const app = new App();
		const folder = await app.vault.createFolder('');
		expect(folder.path).toBe('');
	});

	it('adapter.write modifies existing files', async () => {
		const app = new App();
		await app.vault.create('test.md', 'original');
		await app.vault.adapter.write('test.md', 'updated');
		expect(await app.vault.adapter.read('test.md')).toBe('updated');
	});

	it('getFileCache handles content without frontmatter', () => {
		const app = new App();
		app.vault.setContent('test.md', 'No frontmatter here');
		const file = app.vault.getAbstractFileByPath('test.md');
		// File doesn't exist since we used setContent without create
		expect(file).toBeNull();
	});

	it('getFileCache handles unclosed frontmatter', async () => {
		const app = new App();
		const file = await app.vault.create('test.md', '---\nkey: value\nno closing');
		const cache = app.metadataCache.getFileCache(file);
		expect(cache).toBeNull();
	});

	it('getFileCache handles content without frontmatter delimiter', async () => {
		const app = new App();
		const file = await app.vault.create('test.md', 'Just plain content');
		const cache = app.metadataCache.getFileCache(file);
		expect(cache).toBeNull();
	});
});

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

	it('optionally converts source note to folder note', async () => {
		const app = new App();
		const source = await app.vault.create('Folder/Source Note.md', 'Source content');
		const view = new MarkdownView(source);
		const selection = 'Line one\r\nLine two';
		const editor = new Editor(selection);
		Notice.clear();

		await extractToIncrementalNote(app, editor, view, {
			titleWords: 2,
			tag: '#topic',
			createFolderForExtractedTopics: true,
		});

		expect(app.vault.getAbstractFileByPath('Folder/Source Note.md')).toBeNull();
		expect(app.vault.getAbstractFileByPath('Folder/Source Note/Source Note.md')).not.toBeNull();
		expect(app.vault.getAbstractFileByPath('Folder/Source Note/Line one.md')).not.toBeNull();

		const frontmatter = getFrontmatter(app, 'Folder/Source Note/Line one.md');
		expect(frontmatter.source).toBe('[[Folder/Source Note/Source Note]]');

		const linkText = '[Line one Line two](Folder/Source%20Note/Line%20one.md)';
		expect(editor.getValue()).toBe(linkText);
	});

	it('does not convert when source already is a folder note', async () => {
		const app = new App();
		const source = await app.vault.create(
			'Folder/Source Note/Source Note.md',
			'Source content',
		);
		const view = new MarkdownView(source);
		const selection = 'Line one\r\nLine two';
		const editor = new Editor(selection);
		Notice.clear();

		await extractToIncrementalNote(app, editor, view, {
			titleWords: 2,
			tag: '#topic',
			createFolderForExtractedTopics: true,
		});

		expect(app.vault.getAbstractFileByPath('Folder/Source Note/Source Note.md')).toBe(source);
		expect(
			app.vault.getAbstractFileByPath('Folder/Source Note/Source Note/Source Note.md'),
		).toBeNull();
		expect(app.vault.getAbstractFileByPath('Folder/Source Note/Line one.md')).not.toBeNull();

		const frontmatter = getFrontmatter(app, 'Folder/Source Note/Line one.md');
		expect(frontmatter.source).toBe('[[Folder/Source Note/Source Note]]');

		const linkText = '[Line one Line two](Folder/Source%20Note/Line%20one.md)';
		expect(editor.getValue()).toBe(linkText);
	});

	it('skips conversion when a folder note with same name already exists', async () => {
		const app = new App();
		const existingFolderNote = await app.vault.create(
			'Folder/Source Note/Source Note.md',
			'Existing folder note',
		);
		const source = await app.vault.create('Folder/Source Note.md', 'Source content');
		const view = new MarkdownView(source);
		const selection = 'Line one\r\nLine two';
		const editor = new Editor(selection);
		Notice.clear();

		await extractToIncrementalNote(app, editor, view, {
			titleWords: 2,
			tag: '#topic',
			createFolderForExtractedTopics: true,
		});

		expect(app.vault.getAbstractFileByPath('Folder/Source Note.md')).toBe(source);
		expect(app.vault.getAbstractFileByPath('Folder/Source Note/Source Note.md')).toBe(
			existingFolderNote,
		);
		expect(app.vault.getAbstractFileByPath('Folder/Line one.md')).not.toBeNull();

		const frontmatter = getFrontmatter(app, 'Folder/Line one.md');
		expect(frontmatter.source).toBe('[[Folder/Source Note]]');

		const linkText = '[Line one Line two](Folder/Line%20one.md)';
		expect(editor.getValue()).toBe(linkText);
	});
});
