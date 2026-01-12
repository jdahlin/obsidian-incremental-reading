import type { SessionConfig, SessionItem } from '../types'
import type { SessionStrategy, StrategyContext } from './types'

/**
 * JD1 strategy: priority-weighted scoring with urgency and affinity bonuses.
 *
 * Score composition (approximate ranges):
 * - Priority:     0-10000 (priority 0-100 × 100) — dominates all other factors
 * - TypeWeight:   0-50 (topics get +50)
 * - LinkedAffinity: 0-30 (items linked from last reviewed note)
 * - UrgencyTerm:  0-25 (based on retention probability decay)
 * - RecencyTerm:  0-10 (weeks since last review)
 * - CreatedAge:   0-10 (for new items only, FIFO preference)
 *
 * Total theoretical max: ~10125 for priority=100 topic with all bonuses.
 */
export class JD1Strategy implements SessionStrategy {
	rank(items: SessionItem[], config: SessionConfig, context: StrategyContext): SessionItem[] {
		const scoredItems = items.map((item) => ({
			item,
			score: this.calculateScore(item, context),
		}))

		// Stable sort: score desc, then ID asc for determinism when scores tie
		scoredItems.sort((a, b) => {
			const diff = b.score - a.score
			if (diff !== 0) return diff
			return a.item.item.id.localeCompare(b.item.item.id)
		})

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
		// Urgency uses FSRS-style exponential forgetting curve: R = e^(-t/S)
		// where t = days since review, S = stability (memory half-life proxy)
		// urgency = (1 - R) scales from 0 (just reviewed) to ~25 (forgotten)
		if (state.lastReview) {
			const daysSinceReview = Math.max(
				0,
				(now.getTime() - state.lastReview.getTime()) / (1000 * 60 * 60 * 24),
			)

			const R = Math.exp(-daysSinceReview / Math.max(1, state.stability))
			const urgency = (1 - R) * 25
			score += urgency

			// Recency: +1 point per week since review, max 10
			const recency = Math.min(10, Math.floor(daysSinceReview / 7))
			score += recency
		} else {
			// New items get full urgency (never reviewed = maximally "forgotten")
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
