import { describe, expect, it } from 'vitest';
import { App, FakeElement } from 'obsidian';
import { writeReviewItemFile } from '../../../data/review-items';
import type { ItemState } from '../../../core/types';
import { ReviewController } from '../review-controller';

function makeState(): ItemState {
	return {
		status: 'review',
		due: new Date('2024-01-02T00:00:00'),
		stability: 1,
		difficulty: 1,
		reps: 1,
		lapses: 0,
		last_review: new Date('2024-01-01T00:00:00'),
	};
}

async function withDocument<T>(fn: () => Promise<T> | T): Promise<T> {
	const previousDocument = globalThis.document;
	globalThis.document = { createElement: () => new FakeElement() } as unknown as Document;
	try {
		return await fn();
	} finally {
		globalThis.document = previousDocument;
	}
}

describe('ReviewController', () => {
	it('loads summary data and advances through grading', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Deck/Note.md',
			[
				'---',
				'tags: [topic]',
				'type: topic',
				'priority: 10',
				'created: 2024-01-01T00:00:00',
				'---',
				'Body',
			].join('\n'),
		);
		app.workspace.setActiveFile(note);

		const state = makeState();
		await writeReviewItemFile(app, 'note-1', {
			ir_note_id: 'note-1',
			note_path: note.path,
			type: 'topic',
			priority: 10,
			topic: state,
			clozes: {
				c1: { cloze_uid: 'uid-1', ...state },
			},
		});

		const controller = new ReviewController({
			app,
			view: {},
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		await withDocument(() => controller.refreshSummary());
		const model = controller.getModel();
		expect(model.items).toHaveLength(2);
		expect(model.selectedPath).toBe('Notes/Deck');

		await withDocument(() => controller.startReview());
		expect(controller.getModel().screen).toBe('review');
		expect(controller.getModel().currentItem).not.toBeNull();

		await withDocument(() => controller.gradeCurrentItem(3));
		expect(controller.getModel().sessionStats.reviewed).toBe(1);
	});
});
