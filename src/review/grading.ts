import { Rating } from 'ts-fsrs';
import type { CardState, Status } from '../scheduling/types';

export interface SessionStats {
	started: Date;
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export function gradeTopic(state: CardState, grade: number, now: Date, scrollPos: number): CardState {
	const clamped = Math.max(1, Math.min(4, grade));
	let due: Date;
	switch (clamped) {
		case 1:
			due = addMinutes(now, 10);
			break;
		case 2:
			due = addDays(now, 1);
			break;
		case 3:
			due = addDays(now, 3);
			break;
		default:
			due = addDays(now, 7);
			break;
	}

	const status: Status = clamped === 1 ? 'learning' : 'review';
	return {
		...state,
		due,
		status,
		reps: state.reps + 1,
		lapses: state.lapses + (clamped === 1 ? 1 : 0),
		last_review: now,
		scroll_pos: scrollPos,
	};
}

export function mapGradeToRating(grade: number): Rating {
	switch (grade) {
		case 1:
			return Rating.Again;
		case 2:
			return Rating.Hard;
		case 4:
			return Rating.Easy;
		default:
			return Rating.Good;
	}
}

export function recordSessionGrade(stats: SessionStats, grade: number): void {
	stats.reviewed += 1;
	switch (grade) {
		case 1:
			stats.again += 1;
			break;
		case 2:
			stats.hard += 1;
			break;
		case 4:
			stats.easy += 1;
			break;
		default:
			stats.good += 1;
	}
}

export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
