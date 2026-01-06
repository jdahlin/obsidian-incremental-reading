import { FSRS, Rating, createEmptyCard, generatorParameters, type Card, type Grade } from 'ts-fsrs';
import type { CardState, Status } from './types';

export interface FsrsState {
	due: Date;
	status: Status;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	last_review: Date | null;
}

const STATUS_MAP: Record<Status, number> = {
	new: 0,
	learning: 1,
	review: 2,
	relearning: 3,
};

export function statusToFsrs(status: Status): number {
	return STATUS_MAP[status];
}

export function fsrsToStatus(state: number): Status {
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

export function createScheduler(options?: {
	maximumInterval?: number;
	requestRetention?: number;
	weights?: number[];
}): FSRS {
	const params = generatorParameters({
		maximum_interval: options?.maximumInterval ?? 365,
		request_retention: options?.requestRetention ?? 0.9,
		w: options?.weights,
	});
	return new FSRS(params);
}

export function createNewCard(now: Date = new Date()): CardState {
	const empty = createEmptyCard();
	const fsrsState = cardToState(empty);
	return {
		source: '',
		type: 'item',
		created: now,
		due: fsrsState.due ?? now,
		status: fsrsState.status,
		priority: 50,
		last_review: fsrsState.last_review,
		stability: fsrsState.stability,
		difficulty: fsrsState.difficulty,
		reps: fsrsState.reps,
		lapses: fsrsState.lapses,
		scroll_pos: 0,
	};
}

export function gradeCard(
	scheduler: FSRS,
	state: CardState,
	rating: Rating,
	now: Date = new Date(),
): CardState {
	const card = stateToCard(state);
	const result = scheduler.repeat(card, now);
	const grade = rating as Grade;
	const updated = cardToState(result[grade].card);
	return {
		...state,
		...updated,
	};
}

export function cardToState(card: Card): FsrsState {
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

export function stateToCard(state: CardState): Card {
	return {
		due: state.due,
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
