import type { SessionConfig, SessionItem } from '../types'
import type { SessionStrategy, StrategyContext } from './types'

export class JD1Strategy implements SessionStrategy {
	rank(items: SessionItem[], config: SessionConfig, context: StrategyContext): SessionItem[] {
		const scoredItems = items.map((item) => ({
			item,
			score: this.calculateScore(item, context),
		}))

		// Sort by score descending, then by ID ascending for stability
		scoredItems.sort((a, b) => {
			const diff = b.score - a.score
			if (diff !== 0) return diff
			return a.item.item.id.localeCompare(b.item.item.id)
		})

		// Apply probabilistic interleaving if needed?
		// For now, let's just return the sorted list as the "ideal" order.
		// The 80/20 rule might be better applied in the SessionManager when picking the next item.

		return scoredItems.map((si) => si.item)
	}

	private calculateScore(si: SessionItem, context: StrategyContext): number {
		const { item, state } = si
		const now = context.now

		// 1. Priority (dominates)
		let score = (item.priority ?? 50) * 100

		// 2. TypeWeight
		if (item.type === 'topic') {
			score += 50
		}

		// 3. LinkedAffinity
		if (context.linkedNoteIds.has(item.noteId)) {
			score += 30 // Boost for linked items
		}

		// 4. UrgencyTerm & RecencyTerm
		if (state.lastReview) {
			const daysSinceReview = Math.max(
				0,
				(now.getTime() - state.lastReview.getTime()) / (1000 * 60 * 60 * 24),
			)

			// R = exp(-(days_since_review) / max(1, stability))
			const R = Math.exp(-daysSinceReview / Math.max(1, state.stability))
			const urgency = (1 - R) * 25
			score += urgency

			const recency = Math.min(10, Math.floor(daysSinceReview / 7))
			score += recency
		} else {
			// New items: default urgency
			score += 25
		}

		// 5. CreatedAge - for new items, prefer older created dates (FIFO)
		if (state.status === 'new' && item.created) {
			const ageInDays = (now.getTime() - item.created.getTime()) / (1000 * 60 * 60 * 24)
			score += Math.min(10, ageInDays) // Up to 10 points for age
		}

		return score
	}
}
