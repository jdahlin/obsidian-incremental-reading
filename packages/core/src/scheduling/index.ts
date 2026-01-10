import type { Scheduler, SchedulingParams } from '../types';
import { FSRSScheduler } from './FSRSScheduler';
import { SM2Scheduler } from './SM2Scheduler';

export * from './FSRSScheduler';
export * from './SM2Scheduler';
export * from './TopicScheduler';

export function getScheduler(id: string, params?: SchedulingParams): Scheduler {
	switch (id) {
		case 'fsrs':
			return new FSRSScheduler(params);
		case 'sm2':
			return new SM2Scheduler(params);
		default:
			return new FSRSScheduler(params);
	}
}
