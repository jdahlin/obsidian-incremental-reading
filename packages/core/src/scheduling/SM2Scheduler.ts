import type { Rating, ReviewState, Scheduler, SchedulingParams } from '../types';

export class SM2Scheduler implements Scheduler {
	constructor(private params?: SchedulingParams) {}

	grade(_state: ReviewState, _rating: Rating, _now: Date): ReviewState {
		throw new Error('SM2 scheduler is not implemented yet');
	}

	isDue(state: ReviewState, now: Date): boolean {
		if (!state.due) return true;
		return state.due <= now;
	}
}
