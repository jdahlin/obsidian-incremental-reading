import { startOfDay } from '../core/dates';
import type { StreakInfo, TodayStats } from '../core/types';
import type { App } from 'obsidian';
import { readAllReviews, readReviewsSince } from './revlog';
import { calculateStreak } from '../stats/aggregations';

export async function getTodayStats(app: App, now: Date = new Date()): Promise<TodayStats> {
	const today = startOfDay(now);
	const reviews = await readReviewsSince(app, today);
	const stats: TodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
	for (const review of reviews) {
		stats.reviewed += 1;
		switch (review.rating) {
			case 1:
				stats.again += 1;
				break;
			case 2:
				stats.hard += 1;
				break;
			case 3:
				stats.good += 1;
				break;
			case 4:
				stats.easy += 1;
				break;
			default:
				break;
		}
	}
	return stats;
}

export async function getStreakInfo(app: App, now: Date = new Date()): Promise<StreakInfo> {
	const reviews = await readAllReviews(app);
	const dates = reviews.map((review) => new Date(review.ts));
	return calculateStreak(dates, now);
}
