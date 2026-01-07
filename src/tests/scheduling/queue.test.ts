import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardState } from '../../scheduling/types';
import { dueCard, learningCard, newCard, upcomingCard } from '../fixtures/cards';

const mockGetNotesWithTag = vi.fn();
const mockReadCardState = vi.fn();

vi.mock('../../src/search', () => ({
	getNotesWithTag: (...args: unknown[]) => mockGetNotesWithTag(...args),
}));

vi.mock('../../src/scheduling/frontmatter', () => ({
	readCardState: (...args: unknown[]) => mockReadCardState(...args),
}));

import { buildQueue, getNextCard } from '../../scheduling/queue';

describe('buildQueue categorization', () => {
	beforeEach(() => {
		mockGetNotesWithTag.mockReset();
		mockReadCardState.mockReset();
	});

	it('places new cards in the new queue regardless of due date', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'new.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...newCard, due: new Date('2024-02-01T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.new).toHaveLength(1);
		expect(queue.new[0].state.status).toBe('new');
	});

	it('places due learning cards in the learning queue', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'learning.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...learningCard, due: new Date('2024-01-10T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.learning).toHaveLength(1);
		expect(queue.learning[0].state.status).toBe('learning');
	});

	it('places due review cards in the due queue', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'review.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...dueCard, due: new Date('2024-01-15T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.due).toHaveLength(1);
		expect(queue.due[0].state.status).toBe('review');
	});

	it('places due relearning cards in the learning queue', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'relearning.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...learningCard, status: 'relearning', due: new Date('2024-01-15T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.learning).toHaveLength(1);
		expect(queue.learning[0].state.status).toBe('relearning');
	});

	it('excludes learning cards that are not yet due', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'learning-future.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...learningCard, due: new Date('2024-01-25T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.learning).toHaveLength(0);
	});

	it('excludes review cards that are not yet due', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'review-future.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...dueCard, due: new Date('2024-01-25T00:00:00') });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.due).toHaveLength(0);
	});

	it('increments upcomingCount for cards due in the future', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const file = { path: 'future.md' };
		mockGetNotesWithTag.mockReturnValue([file]);
		mockReadCardState.mockResolvedValue({ ...upcomingCard });

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.upcomingCount).toBe(1);
	});

	it('tracks nextDue as the earliest upcoming card', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const fileA = { path: 'future-a.md' };
		const fileB = { path: 'future-b.md' };
		mockGetNotesWithTag.mockReturnValue([fileA, fileB]);
		const states = new Map<string, CardState>([
			['future-a.md', { ...upcomingCard, due: new Date('2024-02-10T00:00:00') }],
			['future-b.md', { ...upcomingCard, due: new Date('2024-02-01T00:00:00') }],
		]);
		mockReadCardState.mockImplementation(async (_app: unknown, file: { path: string }) => states.get(file.path));

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.nextDue?.getTime()).toBe(new Date('2024-02-01T00:00:00').getTime());
	});
});

describe('queue ordering', () => {
	beforeEach(() => {
		mockGetNotesWithTag.mockReset();
		mockReadCardState.mockReset();
	});

	it('orders learning queue by due date (earliest first)', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const fileA = { path: 'learning-a.md' };
		const fileB = { path: 'learning-b.md' };
		mockGetNotesWithTag.mockReturnValue([fileA, fileB]);
		const states = new Map<string, CardState>([
			['learning-a.md', { ...learningCard, due: new Date('2024-01-12T00:00:00') }],
			['learning-b.md', { ...learningCard, due: new Date('2024-01-11T00:00:00') }],
		]);
		mockReadCardState.mockImplementation(async (_app: unknown, file: { path: string }) => states.get(file.path));

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.learning[0].state.due.getTime()).toBe(new Date('2024-01-11T00:00:00').getTime());
	});

	it('orders due queue by priority, then due date', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const fileA = { path: 'due-a.md' };
		const fileB = { path: 'due-b.md' };
		mockGetNotesWithTag.mockReturnValue([fileA, fileB]);
		const states = new Map<string, CardState>([
			['due-a.md', { ...dueCard, priority: 20, due: new Date('2024-01-12T00:00:00') }],
			['due-b.md', { ...dueCard, priority: 10, due: new Date('2024-01-15T00:00:00') }],
		]);
		mockReadCardState.mockImplementation(async (_app: unknown, file: { path: string }) => states.get(file.path));

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.due[0].state.priority).toBe(10);
	});

	it('orders new queue by priority, then created date', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const fileA = { path: 'new-a.md' };
		const fileB = { path: 'new-b.md' };
		mockGetNotesWithTag.mockReturnValue([fileA, fileB]);
		const states = new Map<string, CardState>([
			['new-a.md', { ...newCard, priority: 20, created: new Date('2024-01-02T00:00:00') }],
			['new-b.md', { ...newCard, priority: 20, created: new Date('2024-01-01T00:00:00') }],
		]);
		mockReadCardState.mockImplementation(async (_app: unknown, file: { path: string }) => states.get(file.path));

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.new[0].state.created.getTime()).toBe(new Date('2024-01-01T00:00:00').getTime());
	});

	it('lower priority number means higher priority', async () => {
		const now = new Date('2024-01-20T00:00:00');
		const fileA = { path: 'new-high.md' };
		const fileB = { path: 'new-low.md' };
		mockGetNotesWithTag.mockReturnValue([fileA, fileB]);
		const states = new Map<string, CardState>([
			['new-high.md', { ...newCard, priority: 10 }],
			['new-low.md', { ...newCard, priority: 50 }],
		]);
		mockReadCardState.mockImplementation(async (_app: unknown, file: { path: string }) => states.get(file.path));

		const queue = await buildQueue({} as never, now, 'topic');
		expect(queue.new[0].state.priority).toBe(10);
	});
});

describe('getNextCard', () => {
	it('returns learning card when learning queue has cards', () => {
		const entry = { file: { path: 'a.md' }, state: learningCard };
		const queue = { learning: [entry], due: [], new: [], nextDue: null, upcomingCount: 0 };
		expect(getNextCard(queue)).toBe(entry);
	});

	it('returns due card when learning is empty but due has cards', () => {
		const entry = { file: { path: 'b.md' }, state: dueCard };
		const queue = { learning: [], due: [entry], new: [], nextDue: null, upcomingCount: 0 };
		expect(getNextCard(queue)).toBe(entry);
	});

	it('returns new card when learning and due are empty', () => {
		const entry = { file: { path: 'c.md' }, state: newCard };
		const queue = { learning: [], due: [], new: [entry], nextDue: null, upcomingCount: 0 };
		expect(getNextCard(queue)).toBe(entry);
	});

	it('returns null when all queues are empty', () => {
		const queue = { learning: [], due: [], new: [], nextDue: null, upcomingCount: 0 };
		expect(getNextCard(queue)).toBeNull();
	});

	it('returns first card from each queue (respects ordering)', () => {
		const learningEntry = { file: { path: 'l.md' }, state: learningCard };
		const dueEntry = { file: { path: 'd.md' }, state: dueCard };
		const newEntry = { file: { path: 'n.md' }, state: newCard };
		const queue = { learning: [learningEntry], due: [dueEntry], new: [newEntry], nextDue: null, upcomingCount: 0 };
		expect(getNextCard(queue)).toBe(learningEntry);
	});
});
