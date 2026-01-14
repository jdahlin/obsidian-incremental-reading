import type { DeepReadonly } from '../core/readonly'
import type { Scheduler, SchedulerId, SchedulingParams } from '../types'
import { assertNever } from '../core/assert'
import { FSRSScheduler } from './FSRSScheduler'
import { SM2Scheduler } from './SM2Scheduler'

export * from './FSRSScheduler'
export * from './SM2Scheduler'
export * from './TopicScheduler'

export function getScheduler(id: SchedulerId, params?: DeepReadonly<SchedulingParams>): Scheduler {
	switch (id) {
		case 'fsrs':
			return new FSRSScheduler(params)
		case 'sm2':
			return new SM2Scheduler(params)
		default:
			return assertNever(id)
	}
}
