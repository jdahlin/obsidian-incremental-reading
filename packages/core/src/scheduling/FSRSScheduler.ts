import type { Card, RecordLog } from 'ts-fsrs';
import type { Rating, ReviewState, Scheduler, SchedulingParams } from '../types';
import { FSRS, Rating as FSRSRating, State as FSRSState, generatorParameters } from 'ts-fsrs';

export class FSRSScheduler implements Scheduler {
	private fsrs: FSRS;

	constructor(params?: SchedulingParams) {
		this.fsrs = new FSRS(
			generatorParameters({
				enable_fuzz: false,
				maximum_interval: params?.maximumInterval ?? 365,
				request_retention: params?.requestRetention ?? 0.9,
				w: params?.weights,
			}),
		);
	}

	grade(state: ReviewState, rating: Rating, now: Date): ReviewState {
		const card = this.toCard(state);
		const fsrsRating = this.toFSRSRating(rating);
		const schedulingCards = this.fsrs.repeat(card, now) as RecordLog;
		const recordLog = schedulingCards[fsrsRating as keyof RecordLog];
		return this.fromCard(recordLog.card);
	}

	isDue(state: ReviewState, now: Date): boolean {
		if (!state.due) return true;
		return state.due <= now;
	}

	applyExamAdjustment(state: ReviewState, examDate: Date, now: Date): ReviewState {
		const targetReviews = 6;
		const minIntervalDays = 1;
		const maxIntervalDays = 60;
		const oneDay = 86400000;

		const daysToExam = Math.max(0, Math.floor((examDate.getTime() - now.getTime()) / oneDay));
		const targetInterval = Math.min(
			Math.max(Math.floor(daysToExam / targetReviews), minIntervalDays),
			maxIntervalDays,
		);

		const schedulerDue = state.due ?? now;
		const adjustedDue = new Date(now.getTime() + targetInterval * oneDay);

		if (schedulerDue > adjustedDue) {
			return {
				...state,
				due: adjustedDue,
			};
		}

		return state;
	}

	private toCard(state: ReviewState): Card {
		return {
			due: state.due ?? new Date(0),
			stability: state.stability,
			difficulty: state.difficulty,
			elapsed_days: 0,
			scheduled_days: 0,
			reps: state.reps,
			lapses: state.lapses,
			state: this.toFSRSState(state.status),
			last_review: state.lastReview ?? undefined,
		} as Card;
	}

	private fromCard(card: Card): ReviewState {
		return {
			status: this.fromFSRSState(card.state),
			due: card.due,
			stability: card.stability,
			difficulty: card.difficulty,
			reps: card.reps,
			lapses: card.lapses,
			lastReview: card.last_review ?? null,
		};
	}

	private toFSRSRating(rating: Rating): FSRSRating {
		switch (rating) {
			case 1:
				return FSRSRating.Again;
			case 2:
				return FSRSRating.Hard;
			case 3:
				return FSRSRating.Good;
			case 4:
				return FSRSRating.Easy;
			default:
				return FSRSRating.Good;
		}
	}

	private toFSRSState(status: ReviewState['status']): FSRSState {
		switch (status) {
			case 'new':
				return FSRSState.New;
			case 'learning':
				return FSRSState.Learning;
			case 'review':
				return FSRSState.Review;
			case 'relearning':
				return FSRSState.Relearning;
		}
	}

	private fromFSRSState(state: FSRSState): ReviewState['status'] {
		switch (state) {
			case FSRSState.New:
				return 'new';
			case FSRSState.Learning:
				return 'learning';
			case FSRSState.Review:
				return 'review';
			case FSRSState.Relearning:
				return 'relearning';
		}
	}
}
