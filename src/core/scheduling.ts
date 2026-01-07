import { FSRS, generatorParameters, type Card, type Grade } from 'ts-fsrs';
import { addDays, addMinutes } from './dates';
import type { FsrsParams, ItemState, Rating, ReviewItem, Status } from './types';

export function mapGradeToRating(grade: number): Rating {
	if (grade <= 1) return 1;
	if (grade === 2) return 2;
	if (grade === 3) return 3;
	return 4;
}

export function gradeTopic(state: ItemState, grade: number, now: Date = new Date()): ItemState {
	let due: Date;
	let status: Status = 'review';
	let lapses = state.lapses;

	switch (grade) {
		case 1:
			status = 'learning';
			due = addMinutes(now, 10);
			lapses += 1;
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

	return {
		...state,
		status,
		due,
		reps: state.reps + 1,
		lapses,
		last_review: now,
	};
}

export function gradeItem(
	state: ItemState,
	rating: Rating,
	now: Date = new Date(),
	fsrsParams: FsrsParams = {},
): ItemState {
	const scheduler = createScheduler(fsrsParams);
	const card = stateToCard(state, now);
	const result = scheduler.repeat(card, now);
	const grade = rating as Grade;
	const updated = cardToState(result[grade].card);

	return {
		...state,
		...updated,
	};
}

export function calculateBurden(items: ReviewItem[]): number {
	return items.reduce((sum, item) => {
		const stability = Number.isFinite(item.state.stability) ? item.state.stability : 0;
		return sum + 1 / Math.max(1, stability);
	}, 0);
}

function createScheduler(options: FsrsParams): FSRS {
	const params = generatorParameters({
		maximum_interval: options.maximumInterval ?? 365,
		request_retention: options.requestRetention ?? 0.9,
		w: options.weights,
	});
	return new FSRS(params);
}

function stateToCard(state: ItemState, now: Date): Card {
	return {
		due: state.due ?? now,
		stability: state.stability,
		difficulty: state.difficulty,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: 0,
		reps: state.reps,
		lapses: state.lapses,
		state: statusToFsrs(state.status),
		last_review: state.last_review ?? undefined,
	};
}

function cardToState(card: Card): ItemState {
	return {
		due: card.due,
		status: fsrsToStatus(card.state),
		stability: card.stability,
		difficulty: card.difficulty,
		reps: card.reps,
		lapses: card.lapses,
		last_review: card.last_review ?? null,
	};
}

function statusToFsrs(status: Status): number {
	switch (status) {
		case 'learning':
			return 1;
		case 'review':
			return 2;
		case 'relearning':
			return 3;
		default:
			return 0;
	}
}

function fsrsToStatus(state: number): Status {
	switch (state) {
		case 1:
			return 'learning';
		case 2:
			return 'review';
		case 3:
			return 'relearning';
		default:
			return 'new';
	}
}
