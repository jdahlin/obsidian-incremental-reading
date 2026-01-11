import type { SessionConfig, SessionItem } from '../types'
import type { SessionStrategy, StrategyContext } from './types'

export class AnkiStrategy implements SessionStrategy {
	rank(items: SessionItem[], config: SessionConfig, context: StrategyContext): SessionItem[] {
		return [...items].sort((a, b) => {
			// Bucket order: learning -> due -> new
			const aBucket = this.getBucket(a, context.now)
			const bBucket = this.getBucket(b, context.now)

			if (aBucket !== bBucket) {
				return bBucket - aBucket
			}

			// Clozes before topics
			if (a.item.type !== b.item.type) {
				return a.item.type === 'cloze' ? -1 : 1
			}

			// Stable secondary sort (id)
			return a.item.id.localeCompare(b.item.id)
		})
	}

	private getBucket(item: SessionItem, now: Date): number {
		if (item.state.status === 'learning' || item.state.status === 'relearning') return 3
		if (item.state.due && item.state.due <= now) return 2
		if (item.state.status === 'new') return 1
		return 0 // Default/Review not yet due
	}
}
