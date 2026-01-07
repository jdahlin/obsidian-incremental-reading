import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { addDays, addMinutes, gradeTopic, mapGradeToRating, recordSessionGrade, type SessionStats } from '../../review/grading';
import type { CardState } from '../../scheduling/types';

const baseState: CardState = {
	source: '',
	type: 'item',
	created: new Date('2024-01-01T00:00:00'),
	due: new Date('2024-01-01T00:00:00'),
	status: 'review',
	priority: 50,
	last_review: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
	scroll_pos: 0,
};

describe('gradeTopic intervals', () => {
	it('grade 1 (Again) -> due in 10 minutes', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 1, now, 0);
		expect(updated.due.getTime()).toBe(addMinutes(now, 10).getTime());
	});

	it('grade 2 (Hard) -> due in 1 day', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 2, now, 0);
		expect(updated.due.getTime()).toBe(addDays(now, 1).getTime());
	});

	it('grade 3 (Good) -> due in 3 days', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 3, now, 0);
		expect(updated.due.getTime()).toBe(addDays(now, 3).getTime());
	});

	it('grade 4 (Easy) -> due in 7 days', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 4, now, 0);
		expect(updated.due.getTime()).toBe(addDays(now, 7).getTime());
	});

	it('clamps grade below 1 to 1', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 0, now, 0);
		expect(updated.due.getTime()).toBe(addMinutes(now, 10).getTime());
	});

	it('clamps grade above 4 to 4', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 5, now, 0);
		expect(updated.due.getTime()).toBe(addDays(now, 7).getTime());
	});
});

describe('gradeTopic status', () => {
	it('grade 1 sets status to learning', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 1, now, 0);
		expect(updated.status).toBe('learning');
	});

	it('grades 2-4 set status to review', () => {
		const now = new Date('2024-01-01T00:00:00');
		expect(gradeTopic(baseState, 2, now, 0).status).toBe('review');
		expect(gradeTopic(baseState, 3, now, 0).status).toBe('review');
		expect(gradeTopic(baseState, 4, now, 0).status).toBe('review');
	});
});

describe('gradeTopic metrics', () => {
	it('increments reps by 1', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic({ ...baseState, reps: 2 }, 2, now, 0);
		expect(updated.reps).toBe(3);
	});

	it('increments lapses by 1 for grade 1', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic({ ...baseState, lapses: 1 }, 1, now, 0);
		expect(updated.lapses).toBe(2);
	});

	it('does not increment lapses for grades 2-4', () => {
		const now = new Date('2024-01-01T00:00:00');
		expect(gradeTopic({ ...baseState, lapses: 1 }, 2, now, 0).lapses).toBe(1);
		expect(gradeTopic({ ...baseState, lapses: 1 }, 3, now, 0).lapses).toBe(1);
		expect(gradeTopic({ ...baseState, lapses: 1 }, 4, now, 0).lapses).toBe(1);
	});

	it('sets last_review to current time', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 2, now, 0);
		expect(updated.last_review?.getTime()).toBe(now.getTime());
	});

	it('preserves scroll_pos from input', () => {
		const now = new Date('2024-01-01T00:00:00');
		const updated = gradeTopic(baseState, 2, now, 123);
		expect(updated.scroll_pos).toBe(123);
	});
});

describe('mapGradeToRating', () => {
	it('maps 1 -> Rating.Again', () => {
		expect(mapGradeToRating(1)).toBe(Rating.Again);
	});

	it('maps 2 -> Rating.Hard', () => {
		expect(mapGradeToRating(2)).toBe(Rating.Hard);
	});

	it('maps 3 -> Rating.Good', () => {
		expect(mapGradeToRating(3)).toBe(Rating.Good);
	});

	it('maps 4 -> Rating.Easy', () => {
		expect(mapGradeToRating(4)).toBe(Rating.Easy);
	});

	it('maps unknown values -> Rating.Good', () => {
		expect(mapGradeToRating(99)).toBe(Rating.Good);
	});
});

describe('recordSessionGrade', () => {
	it('increments reviewed count', () => {
		const stats: SessionStats = { started: new Date(), reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		recordSessionGrade(stats, 3);
		expect(stats.reviewed).toBe(1);
	});

	it('increments again for grade 1', () => {
		const stats: SessionStats = { started: new Date(), reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		recordSessionGrade(stats, 1);
		expect(stats.again).toBe(1);
	});

	it('increments hard for grade 2', () => {
		const stats: SessionStats = { started: new Date(), reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		recordSessionGrade(stats, 2);
		expect(stats.hard).toBe(1);
	});

	it('increments good for grade 3', () => {
		const stats: SessionStats = { started: new Date(), reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		recordSessionGrade(stats, 3);
		expect(stats.good).toBe(1);
	});

	it('increments easy for grade 4', () => {
		const stats: SessionStats = { started: new Date(), reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		recordSessionGrade(stats, 4);
		expect(stats.easy).toBe(1);
	});
});
