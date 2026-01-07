import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { appendReview } from '../../src/data/revlog';
import { getTodayStats, getStreakInfo } from '../../src/data/review-stats';

const now = new Date('2024-01-03T12:00:00');

describe('review stats', () => {
	it('calculates today stats from reviews', async () => {
		const app = new App();
		await appendReview(app, { ts: '2024-01-03T08:00:00', item_id: 'a', rating: 1 });
		await appendReview(app, { ts: '2024-01-03T09:00:00', item_id: 'b', rating: 4 });
		await appendReview(app, { ts: '2024-01-02T09:00:00', item_id: 'c', rating: 3 });

		const stats = await getTodayStats(app, now);
		expect(stats).toEqual({ reviewed: 2, again: 1, hard: 0, good: 0, easy: 1 });
	});

	it('calculates streak info from reviews', async () => {
		const app = new App();
		await appendReview(app, { ts: '2024-01-01T08:00:00', item_id: 'a', rating: 3 });
		await appendReview(app, { ts: '2024-01-02T08:00:00', item_id: 'b', rating: 3 });
		await appendReview(app, { ts: '2024-01-03T08:00:00', item_id: 'c', rating: 3 });

		const streak = await getStreakInfo(app, now);
		expect(streak).toEqual({ current: 3, longest: 3 });
	});
});
