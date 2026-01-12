import type { DeepReadonly } from '../core/readonly'
import type { SessionConfig, SessionItem } from '../types'

export interface SessionStrategy {
	rank: (
		items: readonly DeepReadonly<SessionItem>[],
		config: DeepReadonly<SessionConfig>,
		context: DeepReadonly<StrategyContext>,
	) => SessionItem[]
}

export interface StrategyContext {
	lastNoteId?: string | null
	linkedNoteIds: ReadonlySet<string>
	now: Date
	seed: number
}
