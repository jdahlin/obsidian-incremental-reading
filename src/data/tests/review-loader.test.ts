import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { loadReviewItems } from '../review-loader';
import { writeReviewItemFile } from '../review-items';
import type { ItemState } from '../../core/types';

function makeState(): ItemState {
	return {
		status: 'review',
		due: new Date('2024-01-02T03:04:05'),
		stability: 1,
		difficulty: 2,
		reps: 3,
		lapses: 0,
		last_review: new Date('2024-01-01T03:04:05'),
	};
}

describe('review loader', () => {
	it('loads items from sidecar files', async () => {
		const app = new App();
		const noteFile = await app.vault.create(
			'Notes/Source.md',
			[
				'---',
				'ir_note_id: note-1',
				'tags: [topic]',
				'priority: 10',
				'created: 2024-01-01T00:00:00',
				'---',
				'',
			].join('\n'),
		);

		const state = makeState();
		await writeReviewItemFile(app, 'note-1', {
			ir_note_id: 'note-1',
			note_path: noteFile.path,
			type: 'topic',
			priority: 10,
			topic: state,
			clozes: {
				c1: { cloze_uid: 'uid-1', ...state },
			},
		});

		const items = await loadReviewItems(app, 'topic');
		expect(items).toHaveLength(2);
		const topic = items.find((item) => item.type === 'topic');
		const cloze = items.find((item) => item.type === 'item');
		expect(topic?.notePath).toBe(noteFile.path);
		expect(cloze?.id).toBe('note-1::uid-1');
		expect(cloze?.clozeIndex).toBe(1);
	});
});
