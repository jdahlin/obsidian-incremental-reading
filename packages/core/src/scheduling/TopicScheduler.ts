import type { Rating, ReviewState, Scheduler } from '../types'

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000)
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export class TopicScheduler implements Scheduler {
	grade(state: ReviewState, rating: Rating, now: Date): ReviewState {
		let due: Date
		let status: ReviewState['status'] = 'review'
		let lapses = state.lapses

		switch (rating) {
			case 1:
				status = 'learning'
				due = addMinutes(now, 10)
				lapses += 1
				break
			case 2:
				due = addDays(now, 1)
				break
			case 3:
				due = addDays(now, 3)
				break
			case 4:
				due = addDays(now, 7)
				break
		}

		return {
			...state,
			status,
			due,
			reps: state.reps + 1,
			lapses,
			lastReview: now,
		}
	}

	isDue(state: ReviewState, now: Date): boolean {
		if (!state.due) return true
		return state.due <= now
	}
}
