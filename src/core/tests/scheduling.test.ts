import { describe, expect, it } from 'vitest';
import { mapGradeToRating, gradeTopic, calculateBurden, gradeItem } from '../scheduling';
import type { ItemState, ReviewItem } from '../types';

const now = new Date('2024-01-02T10:00:00');

function makeState(overrides: Partial<ItemState> = {}): ItemState {
	return {
		status: 'new',
		due: null,
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		last_review: null,
		...overrides,
	};
}

describe('scheduling helpers', () => {
	it('maps grades to ratings', () => {
		expect(mapGradeToRating(1)).toBe(1);
		expect(mapGradeToRating(2)).toBe(2);
		expect(mapGradeToRating(3)).toBe(3);
		expect(mapGradeToRating(4)).toBe(4);
		expect(mapGradeToRating(99)).toBe(4);
	});

	it('grades topic with deterministic intervals', () => {
		const base = makeState({ reps: 2, lapses: 1 });
		const graded = gradeTopic(base, 1, now);
		expect(graded.status).toBe('learning');
		expect(graded.reps).toBe(3);
		expect(graded.lapses).toBe(2);
		expect(graded.due?.getTime()).toBe(new Date('2024-01-02T10:10:00').getTime());
	});

	it('calculates burden based on stability', () => {
		const items: ReviewItem[] = [
			{
				id: 'a',
				noteId: 'a',
				notePath: 'a',
				type: 'topic',
				state: makeState({ stability: 0.5 }),
				priority: 0,
			},
			{
				id: 'b',
				noteId: 'b',
				notePath: 'b',
				type: 'topic',
				state: makeState({ stability: 2 }),
				priority: 0,
			},
			{
				id: 'c',
				noteId: 'c',
				notePath: 'c',
				type: 'topic',
				state: makeState({ stability: 0 }),
				priority: 0,
			},
		];
		const burden = calculateBurden(items);
		expect(burden).toBeCloseTo(1 + 0.5 + 1, 5);
	});

	it('grades items via FSRS with sane outputs', () => {
		const base = makeState({ status: 'new', reps: 0, lapses: 0 });
		const graded = gradeItem(base, 3, now, { maximumInterval: 30, requestRetention: 0.9 });
		expect(graded.due).not.toBeNull();
		expect(graded.reps).toBeGreaterThanOrEqual(base.reps);
		expect(Number.isFinite(graded.stability)).toBe(true);
		expect(Number.isFinite(graded.difficulty)).toBe(true);
	});
});
