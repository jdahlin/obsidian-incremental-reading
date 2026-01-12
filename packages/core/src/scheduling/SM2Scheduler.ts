import type { DeepReadonly } from '../core/readonly'
import type { Rating, ReviewState, Scheduler, SchedulingParams } from '../types'

export class SM2Scheduler implements Scheduler {
	constructor(private params?: DeepReadonly<SchedulingParams>) {}

	grade(_state: DeepReadonly<ReviewState>, _rating: Rating, _now: Date): ReviewState {
		throw new Error('SM2 scheduler is not implemented yet')
	}

	isDue(state: DeepReadonly<ReviewState>, now: Date): boolean {
		if (!state.due) return true
		return state.due <= now
	}
}
