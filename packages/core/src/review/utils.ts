import type { DeckInfo } from '../core/types'
import type { ReviewItem, SessionItem } from '../types'
import type { DebugInfo, QueueName, ReviewPhase, SessionStats } from './types'

/**
 * Get clozeIndex from a ReviewItem, or null if not applicable.
 */
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- ReviewItem type
export function getClozeIndex(item: ReviewItem): number | null {
	if (item.type === 'cloze' || item.type === 'image_occlusion') {
		return item.clozeIndex
	}
	return null
}

/**
 * Determine the initial phase for a review item.
 * - Cloze, basic, and image_occlusion cards start with question phase
 * - Topic cards go directly to answer (show full content)
 */
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- SessionItem type
export function determinePhase(item: SessionItem | null): ReviewPhase {
	if (!item) return 'question'
	const type = item.item.type
	if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
		return 'question'
	}
	return 'answer'
}

/**
 * Get the queue name for a given status.
 */
export function getQueueName(status: string): QueueName {
	if (status === 'new') return 'new'
	if (status === 'learning' || status === 'relearning') return 'learning'
	return 'review'
}

/**
 * Build debug info from a session item.
 */
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- SessionItem type
export function buildDebugInfo(item: SessionItem): DebugInfo {
	return {
		queue: getQueueName(item.state.status),
		status: item.state.status,
		priority: item.item.priority,
		due: item.state.due?.toISOString() ?? null,
		stability: item.state.stability,
		difficulty: item.state.difficulty,
		reps: item.state.reps,
		lapses: item.state.lapses,
	}
}

/**
 * Flatten a deck tree into a flat array.
 */
/* eslint-disable ts/prefer-readonly-parameter-types -- DeckInfo type */
export function flattenDecks(decks: readonly DeckInfo[]): readonly DeckInfo[] {
	const rows: DeckInfo[] = []
	const walk = (nodes: readonly DeckInfo[]): void => {
		/* eslint-enable ts/prefer-readonly-parameter-types */
		for (const node of nodes) {
			rows.push(node)
			if (node.children.length > 0) walk(node.children)
		}
	}
	walk(decks)
	return rows
}

/**
 * Create empty session stats.
 */
export function createSessionStats(): SessionStats {
	return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
}
