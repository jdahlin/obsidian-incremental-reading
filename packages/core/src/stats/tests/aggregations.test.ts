import type { ReviewItem, ReviewRecord } from '../../core/types';
import { describe, expect, it } from 'vitest';
import {
	buildForecastData,
	buildHeatmapData,
	calculateAnswerDistribution,
	calculateRetention,
	calculateStreak,
} from '../aggregations';

const today = new Date('2024-01-03T10:00:00');

describe('stats aggregations', () => {
	it('calculates retention', () => {
		const reviews: ReviewRecord[] = [
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 1 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 2 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 3 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 4 },
		];
		expect(calculateRetention(reviews)).toBe(0.75);
	});

	it('calculates streaks', () => {
		const dates = [
			new Date('2024-01-01T10:00:00'),
			new Date('2024-01-02T10:00:00'),
			new Date('2024-01-03T10:00:00'),
		];
		const streak = calculateStreak(dates, today);
		expect(streak).toEqual({ current: 3, longest: 3 });
	});

	it('calculates answer distribution', () => {
		const reviews: ReviewRecord[] = [
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 1 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 2 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 3 },
			{ ts: '2024-01-01T00:00:00', item_id: 'a', rating: 4 },
		];
		expect(calculateAnswerDistribution(reviews)).toEqual({
			again: 1,
			hard: 1,
			good: 1,
			easy: 1,
		});
	});

	it('builds heatmap data', () => {
		const reviews: ReviewRecord[] = [
			{ ts: '2024-01-01T10:00:00', item_id: 'a', rating: 3 },
			{ ts: '2024-01-01T11:00:00', item_id: 'b', rating: 3 },
			{ ts: '2024-01-03T10:00:00', item_id: 'c', rating: 3 },
		];
		const heatmap = buildHeatmapData(reviews, 3, today);
		expect(heatmap).toEqual([
			{ date: '2024-01-01', count: 2 },
			{ date: '2024-01-02', count: 0 },
			{ date: '2024-01-03', count: 1 },
		]);
	});

	it('builds forecast data', () => {
		const items: ReviewItem[] = [
			{
				id: 'a',
				noteId: 'a',
				notePath: 'a',
				type: 'topic',
				priority: 0,
				state: {
					status: 'review',
					due: new Date('2024-01-03T10:00:00'),
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			},
			{
				id: 'b',
				noteId: 'b',
				notePath: 'b',
				type: 'topic',
				priority: 0,
				state: {
					status: 'review',
					due: new Date('2024-01-04T10:00:00'),
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			},
		];
		const forecast = buildForecastData(items, 2, today);
		expect(forecast).toEqual([
			{ date: '2024-01-03', count: 1 },
			{ date: '2024-01-04', count: 1 },
		]);
	});
});
