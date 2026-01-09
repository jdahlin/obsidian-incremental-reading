import type { SessionItem, SessionConfig } from '../types';

export interface SessionStrategy {
	rank(items: SessionItem[], config: SessionConfig, context: StrategyContext): SessionItem[];
}

export interface StrategyContext {
	lastNoteId?: string | null;
	linkedNoteIds: Set<string>;
	now: Date;
	seed: number;
}
