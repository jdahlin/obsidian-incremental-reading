import type { ReviewItem, ReviewRecord, StreakInfo } from '../core/types';
import { addDays, startOfDay } from '../core/dates';

export interface AnswerDistribution {
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export interface HeatmapData {
	date: string;
	count: number;
}

export interface ForecastData {
	date: string;
	count: number;
}

export function calculateRetention(reviews: ReviewRecord[]): number {
	if (!reviews.length) return 0;
	const successes = reviews.filter((review) => review.rating > 1).length;
	return successes / reviews.length;
}

export function calculateStreak(reviewDates: Date[], today: Date = new Date()): StreakInfo {
	const dayKeys = new Set<string>();
	for (const date of reviewDates) {
		if (Number.isNaN(date.getTime())) continue;
		dayKeys.add(dateKey(date));
	}

	const sortedDays = Array.from(dayKeys)
		.map((key) => new Date(`${key}T00:00:00`))
		.sort((a, b) => a.getTime() - b.getTime());

	let longest = 0;
	let currentRun = 0;
	let lastDay: Date | null = null;

	for (const day of sortedDays) {
		if (!lastDay) {
			currentRun = 1;
			longest = Math.max(longest, currentRun);
			lastDay = day;
			continue;
		}
		const diff = startOfDay(day).getTime() - startOfDay(lastDay).getTime();
		if (diff === 24 * 60 * 60 * 1000) {
			currentRun += 1;
		} else if (diff > 0) {
			currentRun = 1;
		}
		longest = Math.max(longest, currentRun);
		lastDay = day;
	}

	const todayKey = dateKey(today);
	if (!dayKeys.has(todayKey)) {
		return { current: 0, longest };
	}

	let current = 1;
	let cursor = startOfDay(today);
	while (true) {
		cursor = addDays(cursor, -1);
		if (!dayKeys.has(dateKey(cursor))) break;
		current += 1;
	}

	return { current, longest };
}

export function calculateAnswerDistribution(reviews: ReviewRecord[]): AnswerDistribution {
	const distribution: AnswerDistribution = { again: 0, hard: 0, good: 0, easy: 0 };
	for (const review of reviews) {
		switch (review.rating) {
			case 1:
				distribution.again += 1;
				break;
			case 2:
				distribution.hard += 1;
				break;
			case 3:
				distribution.good += 1;
				break;
			case 4:
				distribution.easy += 1;
				break;
			default:
				break;
		}
	}
	return distribution;
}

export function buildHeatmapData(
	reviews: ReviewRecord[],
	days: number,
	today: Date = new Date(),
): HeatmapData[] {
	const byDay = new Map<string, number>();
	for (const review of reviews) {
		const date = new Date(review.ts);
		if (Number.isNaN(date.getTime())) continue;
		const key = dateKey(date);
		byDay.set(key, (byDay.get(key) ?? 0) + 1);
	}

	const result: HeatmapData[] = [];
	let cursor = startOfDay(today);
	for (let i = 0; i < days; i += 1) {
		const key = dateKey(cursor);
		result.unshift({ date: key, count: byDay.get(key) ?? 0 });
		cursor = addDays(cursor, -1);
	}
	return result;
}

export function buildForecastData(
	items: ReviewItem[],
	days: number,
	now: Date = new Date(),
): ForecastData[] {
	const byDay = new Map<string, number>();
	for (const item of items) {
		const due = item.state.due;
		if (!due) continue;
		const key = dateKey(due);
		byDay.set(key, (byDay.get(key) ?? 0) + 1);
	}

	const result: ForecastData[] = [];
	let cursor = startOfDay(now);
	for (let i = 0; i < days; i += 1) {
		const key = dateKey(cursor);
		result.push({ date: key, count: byDay.get(key) ?? 0 });
		cursor = addDays(cursor, 1);
	}
	return result;
}

function dateKey(date: Date): string {
	const normalized = startOfDay(date);
	const year = normalized.getFullYear();
	const month = String(normalized.getMonth() + 1).padStart(2, '0');
	const day = String(normalized.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
