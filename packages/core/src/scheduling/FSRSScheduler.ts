import type { Card, RecordLog } from 'ts-fsrs'
import type { DeepReadonly } from '../core/readonly'
import type { Rating, ReviewState, Scheduler, SchedulingParams } from '../types'
import { FSRS, Rating as FSRSRating, State as FSRSState, generatorParameters } from 'ts-fsrs'
import { assertNever } from '../core/assert'

export class FSRSScheduler implements Scheduler {
	private fsrs: FSRS

	constructor(params?: DeepReadonly<SchedulingParams>) {
		this.fsrs = new FSRS(
			generatorParameters({
				enable_fuzz: false,
				maximum_interval: params?.maximumInterval ?? 365,
				request_retention: params?.requestRetention ?? 0.9,
				w: params?.weights,
			}),
		)
	}

	grade(state: DeepReadonly<ReviewState>, rating: Rating, now: Date): ReviewState {
		const card = this.toCard(state)
		const fsrsRating = this.toFSRSRating(rating)
		const schedulingCards = this.fsrs.repeat(card, now) as RecordLog
		const recordLog = schedulingCards[fsrsRating as keyof RecordLog]
		return this.fromCard(recordLog.card)
	}

	isDue(state: DeepReadonly<ReviewState>, now: Date): boolean {
		if (!state.due) return true
		return state.due <= now
	}

	/**
	 * Pulls due dates forward to ensure adequate reviews before an exam.
	 * Goal: ~6 reviews spread across the time remaining until exam.
	 *
	 * Algorithm:
	 * - targetInterval = daysToExam / 6, clamped to [1, 60] days
	 * - If card's current due date is AFTER (now + targetInterval), pull it forward
	 * - Cards already due sooner than target are not modified
	 *
	 * This is a one-way adjustment (only pulls forward, never pushes back).
	 */
	applyExamAdjustment(state: DeepReadonly<ReviewState>, examDate: Date, now: Date): ReviewState {
		const targetReviews = 6
		const minIntervalDays = 1
		const maxIntervalDays = 60
		const oneDay = 86400000

		const daysToExam = Math.max(0, Math.floor((examDate.getTime() - now.getTime()) / oneDay))
		const targetInterval = Math.min(
			Math.max(Math.floor(daysToExam / targetReviews), minIntervalDays),
			maxIntervalDays,
		)

		const schedulerDue = state.due ?? now
		const adjustedDue = new Date(now.getTime() + targetInterval * oneDay)

		// Only adjust if current due is later than our target
		if (schedulerDue > adjustedDue) {
			return {
				...state,
				due: adjustedDue,
			}
		}

		return state
	}

	/**
	 * Converts our ReviewState to ts-fsrs Card format.
	 * elapsed_days/scheduled_days are set to 0 because FSRS computes them from dates.
	 * due defaults to epoch (Date(0)) for new cards to avoid undefined issues.
	 */
	private toCard(state: DeepReadonly<ReviewState>): Card {
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
		} as Card
	}

	private fromCard(card: DeepReadonly<Card>): ReviewState {
		return {
			status: this.fromFSRSState(card.state),
			due: card.due,
			stability: card.stability,
			difficulty: card.difficulty,
			reps: card.reps,
			lapses: card.lapses,
			lastReview: card.last_review ?? null,
		}
	}

	private toFSRSRating(rating: Rating): FSRSRating {
		switch (rating) {
			case 1:
				return FSRSRating.Again
			case 2:
				return FSRSRating.Hard
			case 3:
				return FSRSRating.Good
			case 4:
				return FSRSRating.Easy
			default:
				return assertNever(rating)
		}
	}

	private toFSRSState(status: ReviewState['status']): FSRSState {
		switch (status) {
			case 'new':
				return FSRSState.New
			case 'learning':
				return FSRSState.Learning
			case 'review':
				return FSRSState.Review
			case 'relearning':
				return FSRSState.Relearning
		}
	}

	private fromFSRSState(state: FSRSState): ReviewState['status'] {
		switch (state) {
			case FSRSState.New:
				return 'new'
			case FSRSState.Learning:
				return 'learning'
			case FSRSState.Review:
				return 'review'
			case FSRSState.Relearning:
				return 'relearning'
		}
	}
}
