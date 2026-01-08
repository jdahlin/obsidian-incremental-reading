import { describe, expect, it } from 'vitest';
import { App, TFile } from 'obsidian';
import {
	ensureNoteId,
	writeReviewItemFile,
	readReviewItemFile,
	updateClozeState,
	updateTopicState,
	updateReviewItemNotePath,
	deleteReviewItemFile,
	getReviewItemPath,
} from '../../src/data/review-items';
import type { ItemState } from '../../src/core/types';

function frontmatterOf(app: App, file: TFile): Record<string, unknown> {
	return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

function makeState(overrides: Partial<ItemState> = {}): ItemState {
	return {
		status: 'review',
		due: new Date('2024-01-02T03:04:05'),
		stability: 1.2,
		difficulty: 2.3,
		reps: 4,
		lapses: 1,
		last_review: new Date('2024-01-01T02:03:04'),
		...overrides,
	};
}

describe('review item files', () => {
	it('returns existing note id from frontmatter', async () => {
		const app = new App();
		const file = await app.vault.create(
			'Notes/Note.md',
			['---', 'ir_note_id: existing', 'tags: [topic]', '---', ''].join('\n'),
		);

		const noteId = await ensureNoteId(app, file);
		expect(noteId).toBe('existing');
	});

	it('creates a note id when missing', async () => {
		const app = new App();
		const file = await app.vault.create(
			'Notes/Note.md',
			['---', 'tags: [topic]', '---', ''].join('\n'),
		);

		const noteId = await ensureNoteId(app, file);
		expect(noteId).toHaveLength(12);

		const fm = frontmatterOf(app, file);
		expect(typeof fm.ir_note_id).toBe('string');
	});

	it('writes and reads review item data', async () => {
		const app = new App();
		const noteId = 'note-1';
		const path = getReviewItemPath(noteId);
		const state = makeState();

		await writeReviewItemFile(app, noteId, {
			ir_note_id: noteId,
			note_path: 'Notes/Note.md',
			type: 'item',
			priority: 25,
			cloze: ['c1'],
			topic: state,
			clozes: {
				c1: { cloze_uid: 'uid-1', ...state },
			},
		});

		const stored = app.vault.getAbstractFileByPath(path) as TFile | null;
		expect(stored).not.toBeNull();

		const parsed = await readReviewItemFile(app, noteId);
		expect(parsed?.ir_note_id).toBe(noteId);
		expect(parsed?.note_path).toBe('Notes/Note.md');
		expect(parsed?.priority).toBe(25);
		expect(parsed?.clozes?.c1?.cloze_uid).toBe('uid-1');
		expect(parsed?.topic?.due?.getTime()).toBe(state.due?.getTime());
	});

	it('updates cloze and topic states', async () => {
		const app = new App();
		const noteId = 'note-2';
		const state = makeState({ status: 'learning' });

		await updateClozeState(app, noteId, 1, state, 'Notes/Note.md');
		await updateTopicState(app, noteId, state, 'Notes/Note.md');

		const parsed = await readReviewItemFile(app, noteId);
		expect(parsed?.clozes?.c1?.status).toBe('learning');
		expect(parsed?.topic?.status).toBe('learning');
	});

	it('updates note path and deletes file', async () => {
		const app = new App();
		const noteId = 'note-3';
		await writeReviewItemFile(app, noteId, {
			ir_note_id: noteId,
			note_path: 'Notes/Old.md',
		});

		await updateReviewItemNotePath(app, noteId, 'Notes/New.md');
		const updated = await readReviewItemFile(app, noteId);
		expect(updated?.note_path).toBe('Notes/New.md');

		await deleteReviewItemFile(app, noteId);
		const removed = app.vault.getAbstractFileByPath(getReviewItemPath(noteId));
		expect(removed).toBeNull();
	});
});
