import type { ReviewState, Scheduler, Rating } from '../types';

export class SM2Scheduler implements Scheduler {
	grade(state: ReviewState, rating: Rating, now: Date): ReviewState {
		throw new Error('SM2 scheduler is not implemented yet');
	}

	isDue(state: ReviewState, now: Date): boolean {
		if (!state.due) return true;
		return state.due <= now;
	}
}
