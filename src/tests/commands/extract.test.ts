import { describe, expect, it, vi } from 'vitest';
import type { MarkdownView } from 'obsidian';
import { extractToIncrementalNote, escapeMarkdownLinkText, sanitizeTitle, titleFromSelection } from '../../commands/extract';

describe('titleFromSelection', () => {
	it('uses first N words as title', () => {
		expect(titleFromSelection('one two three four five six', 3)).toBe('one two three');
	});

	it('defaults to "Extract" for empty selection', () => {
		expect(titleFromSelection('   ', 3)).toBe('Extract');
	});

	it('collapses multiple spaces to single space', () => {
		expect(titleFromSelection('one   two    three', 3)).toBe('one two three');
	});

	it('trims leading and trailing whitespace', () => {
		expect(titleFromSelection('   one two   ', 2)).toBe('one two');
	});

	it('handles selection shorter than maxWords', () => {
		expect(titleFromSelection('one two', 5)).toBe('one two');
	});
});

describe('sanitizeTitle', () => {
	it('removes forward slash /', () => {
		expect(sanitizeTitle('a/b')).toBe('ab');
	});

	it('removes backslash \\\\', () => {
		expect(sanitizeTitle('a\\b')).toBe('ab');
	});

	it('removes colon :', () => {
		expect(sanitizeTitle('a:b')).toBe('ab');
	});

	it('removes pipe |', () => {
		expect(sanitizeTitle('a|b')).toBe('ab');
	});

	it('removes question mark ?', () => {
		expect(sanitizeTitle('a?b')).toBe('ab');
	});

	it('removes asterisk *', () => {
		expect(sanitizeTitle('a*b')).toBe('ab');
	});

	it('removes double quote \"', () => {
		expect(sanitizeTitle('a"b')).toBe('ab');
	});

	it('removes less than <', () => {
		expect(sanitizeTitle('a<b')).toBe('ab');
	});

	it('removes greater than >', () => {
		expect(sanitizeTitle('a>b')).toBe('ab');
	});

	it('preserves normal characters and spaces', () => {
		expect(sanitizeTitle('Alpha Beta')).toBe('Alpha Beta');
	});

	it('truncates to 120 characters', () => {
		const long = 'a'.repeat(140);
		expect(sanitizeTitle(long).length).toBe(120);
	});

	it('collapses multiple spaces after removal', () => {
		expect(sanitizeTitle('a   b   c')).toBe('a b c');
	});
});

describe('escapeMarkdownLinkText', () => {
	it('escapes closing bracket ] to \\]', () => {
		expect(escapeMarkdownLinkText('a]b')).toBe('a\\]b');
	});

	it('replaces newlines with spaces', () => {
		expect(escapeMarkdownLinkText('a\nb\r\nc')).toBe('a b c');
	});

	it('trims result', () => {
		expect(escapeMarkdownLinkText('  a b  ')).toBe('a b');
	});
});

describe('extractToIncrementalNote', () => {
	it('creates a child note with minimal frontmatter and normalized content', async () => {
		const selection = 'Line one\r\nLine two';
		const editor = {
			getSelection: vi.fn(() => selection),
			replaceSelection: vi.fn(),
			getCursor: vi.fn(() => ({ line: 0, ch: 0 })),
			setSelection: vi.fn(),
		};
		const created: { path?: string; content?: string } = {};
		const plugin = {
			app: {
				vault: {
					create: vi.fn((path: string, content: string) => {
						created.path = path;
						created.content = content;
						return Promise.resolve();
					}),
					getAbstractFileByPath: vi.fn(() => null),
				},
			},
		};
		const view = {
			file: {
				basename: 'Source Note',
				parent: { path: 'Folder' },
			},
		} as MarkdownView;

		const now = new Date('2024-01-02T03:04:05');
		await extractToIncrementalNote(plugin as never, editor as never, view, {
			titleWords: 2,
			tag: '#topic',
			now,
		});

		expect(created.path).toBe('Folder/Line one.md');
		expect(created.content).toContain('---\nsource: "[[Folder/Source Note]]"\ntags: [topic]\ncreated: 2024-01-02T03:04:05\n---');
		expect(created.content).toContain('Line one\nLine two');
	});

	it('replaces selection with a markdown link to the new note', async () => {
		const selection = 'Some [text]';
		const editor = {
			getSelection: vi.fn(() => selection),
			replaceSelection: vi.fn(),
			getCursor: vi.fn(() => ({ line: 0, ch: 0 })),
			setSelection: vi.fn(),
		};
		const plugin = {
			app: {
				vault: {
					create: vi.fn(() => Promise.resolve()),
					getAbstractFileByPath: vi.fn(() => null),
				},
			},
		};
		const view = {
			file: {
				basename: 'Source Note',
				parent: { path: 'Folder' },
			},
		} as MarkdownView;

		await extractToIncrementalNote(plugin as never, editor as never, view, {
			titleWords: 1,
			tag: 'topic',
			now: new Date('2024-01-02T03:04:05'),
		});

		expect(editor.replaceSelection).toHaveBeenCalledWith('[Some [text\\]](Folder/Some.md)');
	});
});
