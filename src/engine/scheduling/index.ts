export * from './FSRSScheduler';
export * from './SM2Scheduler';

import { FSRSScheduler } from './FSRSScheduler';
import { SM2Scheduler } from './SM2Scheduler';
import type { Scheduler } from '../types';

export function getScheduler(id: string): Scheduler {
	switch (id) {
		case 'fsrs':
			return new FSRSScheduler();
		case 'sm2':
			return new SM2Scheduler();
		default:
			return new FSRSScheduler();
	}
}
