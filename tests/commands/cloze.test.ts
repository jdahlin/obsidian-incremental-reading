import { describe, expect, it } from 'vitest';
import { App, Editor, Notice } from 'obsidian';
import { clozeSelection, clozeSelectionNextIndex, clozeSelectionSameIndex } from '../../src/commands/cloze';

const app = new App();

describe('cloze selection', () => {
	it('wraps selection in cloze markup', async () => {
		const editor = new Editor('alpha');
		await clozeSelection(app, editor, null, { index: 2 });
		expect(editor.getValue()).toBe('{{c2::alpha}}');
	});

	it('uses the next available index', async () => {
		const editor = new Editor('delta {{c1::beta}}');
		editor.setSelectionByOffset(0, 5);
		await clozeSelectionNextIndex(app, editor, null, {});
		expect(editor.getValue()).toBe('{{c2::delta}} {{c1::beta}}');
	});

	it('reuses the last cloze index', async () => {
		const editor = new Editor('first');
		await clozeSelection(app, editor, null, { index: 3 });
		editor.setValue('second');
		await clozeSelectionSameIndex(app, editor, null, {});
		expect(editor.getValue()).toBe('{{c3::second}}');
	});

	it('shows a notice when selection is empty', async () => {
		Notice.clear();
		const editor = new Editor('   ');
		await clozeSelection(app, editor, null, {});
		expect(Notice.messages).toContain('No selection to cloze.');
	});

	it('updates frontmatter and sidecar when file is provided', async () => {
		const note = await app.vault.create(
			'Notes/Note.md',
			['---', 'tags: [topic]', 'type: topic', '---', 'Alpha', ''].join('\n'),
		);
		const editor = new Editor('Alpha');
		await clozeSelection(app, editor, note, { index: 1, extractTag: 'topic' });

		const fm = app.metadataCache.getFileCache(note)?.frontmatter ?? {};
		expect(fm.type).toBe('item');
		expect(fm.ir_note_id).toBeTruthy();

		const noteId = fm.ir_note_id as string;
		const sidecarPath = `IR/Review Items/${noteId}.md`;
		expect(app.vault.getAbstractFileByPath(sidecarPath)).not.toBeNull();
	});
});
