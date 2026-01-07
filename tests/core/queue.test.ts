import { describe, expect, it } from 'vitest';
import { buildQueue, categorizeItems, filterByFolder, getNextItem, getQueueStats } from '../../src/core/queue';
import type { ReviewItem } from '../../src/core/types';

const now = new Date('2024-01-02T10:00:00');

function makeItem(partial: Partial<ReviewItem>): ReviewItem {
	return {
		id: partial.id ?? 'id',
		noteId: partial.noteId ?? 'note',
		notePath: partial.notePath ?? 'Folder/Note.md',
		type: partial.type ?? 'topic',
		clozeIndex: partial.clozeIndex ?? null,
		state: partial.state ?? {
			status: 'new',
			due: now,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			last_review: null,
		},
		priority: partial.priority ?? 50,
		created: partial.created ?? new Date('2024-01-01T00:00:00'),
	};
}

describe('queue filtering and categorization', () => {
	it('filters by folder path', () => {
		const items = [
			makeItem({ notePath: 'A/One.md' }),
			makeItem({ notePath: 'A/B/Two.md' }),
			makeItem({ notePath: 'C/Three.md' }),
		];
		const filtered = filterByFolder(items, 'A');
		expect(filtered.map((item) => item.notePath)).toEqual(['A/One.md', 'A/B/Two.md']);
	});

	it('categorizes items by status and due date', () => {
		const items = [
			makeItem({
				id: 'new',
				state: { status: 'new', due: new Date('2024-01-01T00:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
			}),
			makeItem({
				id: 'learning',
				state: { status: 'learning', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
			}),
			makeItem({
				id: 'due',
				state: { status: 'review', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
			}),
			makeItem({
				id: 'upcoming',
				state: { status: 'review', due: new Date('2024-01-03T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
			}),
		];

		const categorized = categorizeItems(items, now);
		expect(categorized.new.map((item) => item.id)).toEqual(['new']);
		expect(categorized.learning.map((item) => item.id)).toEqual(['learning']);
		expect(categorized.due.map((item) => item.id)).toEqual(['due']);
		expect(categorized.upcoming.map((item) => item.id)).toEqual(['upcoming']);
	});
});

describe('queue building', () => {
	it('sorts and limits queues', () => {
		const items = [
			makeItem({
				id: 'learning-late',
				state: { status: 'learning', due: new Date('2024-01-02T09:30:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 20,
			}),
			makeItem({
				id: 'learning-early',
				state: { status: 'learning', due: new Date('2024-01-02T08:30:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 10,
			}),
			makeItem({
				id: 'due-high',
				state: { status: 'review', due: new Date('2024-01-02T07:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 5,
			}),
			makeItem({
				id: 'due-low',
				state: { status: 'review', due: new Date('2024-01-02T06:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 50,
			}),
			makeItem({
				id: 'new-first',
				state: { status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 10,
				created: new Date('2024-01-01T00:00:00'),
			}),
			makeItem({
				id: 'new-second',
				state: { status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null },
				priority: 10,
				created: new Date('2024-01-02T00:00:00'),
			}),
		];

		const queue = buildQueue(items, now, { newCardsLimit: 1 });
		expect(queue.learning.map((item) => item.id)).toEqual(['learning-early', 'learning-late']);
		expect(queue.due.map((item) => item.id)).toEqual(['due-high', 'due-low']);
		expect(queue.new.map((item) => item.id)).toEqual(['new-first']);
	});

	it('returns next item in priority order', () => {
		const queue = buildQueue([
			makeItem({ id: 'learning', state: { status: 'learning', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null } }),
			makeItem({ id: 'due', state: { status: 'review', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null } }),
		], now, { newCardsLimit: 10 });
		expect(getNextItem(queue)?.id).toBe('learning');
	});

	it('computes queue stats', () => {
		const queue = buildQueue([
			makeItem({ id: 'learning', state: { status: 'learning', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null } }),
			makeItem({ id: 'due', state: { status: 'review', due: new Date('2024-01-02T09:00:00'), stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null } }),
			makeItem({ id: 'new', state: { status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null } }),
		], now, { newCardsLimit: 10 });

		const stats = getQueueStats(queue);
		expect(stats).toEqual({ learning: 1, due: 1, new: 1, total: 3 });
	});
});
