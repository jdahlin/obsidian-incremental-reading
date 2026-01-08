import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { syncNoteToSidecar, syncAllNotes } from '../../src/data/sync';
import { readReviewItemFile } from '../../src/data/review-items';

describe('sync sidecar files', () => {
	it('creates sidecar with cloze entries', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Source.md',
			[
				'---',
				'tags: [topic]',
				'type: topic',
				'priority: 70',
				'---',
				'Text {{c1::alpha}} and {{c2::beta}}',
				'',
			].join('\n'),
		);

		await syncNoteToSidecar(app, note, 'topic');

		const fm = app.metadataCache.getFileCache(note)?.frontmatter ?? {};
		const noteId = fm.ir_note_id as string;
		expect(noteId).toBeTruthy();

		const sidecar = await readReviewItemFile(app, noteId);
		expect(sidecar?.note_path).toBe(note.path);
		expect(sidecar?.cloze).toEqual(['c1', 'c2']);
		expect(Object.keys(sidecar?.clozes ?? {})).toEqual(['c1', 'c2']);
	});

	it('removes sidecars when notes are no longer synced', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/ToRemove.md',
			['---', 'tags: [topic]', 'type: topic', '---', 'Text', ''].join('\n'),
		);

		await syncAllNotes(app, 'topic');
		const noteId = (app.metadataCache.getFileCache(note)?.frontmatter ?? {})
			.ir_note_id as string;
		const sidecarPath = `IR/Review Items/${noteId}.md`;
		expect(app.vault.getAbstractFileByPath(sidecarPath)).not.toBeNull();

		await app.fileManager.processFrontMatter(note, (fm) => {
			fm.tags = [];
		});
		await syncAllNotes(app, 'topic');
		expect(app.vault.getAbstractFileByPath(sidecarPath)).toBeNull();
	});
});
