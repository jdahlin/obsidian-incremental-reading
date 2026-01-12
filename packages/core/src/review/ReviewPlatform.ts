import type { DeckInfo, StreakInfo, TodayStats } from '../core/types'
import type { ItemType, Status } from '../types'
import type { ReviewPhase } from './types'

/**
 * Information needed to render a review item's content.
 */
export interface ContentRenderInfo {
	readonly id: string
	readonly noteId: string
	readonly notePath: string
	readonly type: ItemType
	readonly clozeIndex: number | null
	readonly phase: ReviewPhase
}

/**
 * Card info for display in a modal.
 */
export interface CardInfo {
	readonly id: string
	readonly noteId: string
	readonly notePath: string
	readonly type: ItemType
	readonly status: Status
	readonly due: Date | null
	readonly stability: number
	readonly difficulty: number
	readonly reps: number
	readonly lapses: number
	readonly lastReview: Date | null
	readonly priority: number
}

/**
 * Queue counts with total.
 */
export interface QueueCounts {
	readonly new: number
	readonly learning: number
	readonly due: number
	readonly total: number
}

/**
 * Current item state for session debugging.
 */
export interface SessionCurrentItem {
	readonly id: string
	readonly noteId: string
	readonly notePath: string
	readonly type: ItemType
	readonly clozeIndex: number | null
	readonly phase: ReviewPhase
	readonly rawMarkdown: string | null
	readonly formattedMarkdown: string | null
}

/**
 * Session review statistics.
 */
export interface SessionReviewStats {
	readonly startedAt: string | null
	readonly reviewed: number
	readonly again: number
	readonly hard: number
	readonly good: number
	readonly easy: number
}

/**
 * Session state data for debugging and persistence.
 */
export interface SessionStateData {
	readonly deck: string | null
	readonly currentItem: SessionCurrentItem | null
	readonly queue: QueueCounts
	readonly session: SessionReviewStats
	readonly lastError: string | null
	readonly updatedAt: string
}

/**
 * Platform-specific adapter for review functionality.
 *
 * This interface abstracts platform-specific operations (e.g., rendering markdown,
 * showing modals, persisting session state) so the ReviewController can be platform-agnostic.
 */
export interface ReviewPlatform {
	/**
	 * Render the content for a review item in the given phase.
	 * Returns HTML string for display.
	 */
	readonly getContent: (info: ContentRenderInfo, extractTag: string) => Promise<string>

	/**
	 * Get today's review statistics.
	 */
	readonly getTodayStats: (now: Date) => Promise<TodayStats>

	/**
	 * Get streak information.
	 */
	readonly getStreakInfo: (now: Date) => Promise<StreakInfo>

	/**
	 * Get the preselected deck path based on available decks.
	 * Returns null if no preselection should be made.
	 */
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DeckInfo type
	readonly getPreselectedPath: (decks: readonly DeckInfo[]) => string | null

	/**
	 * Subscribe to data changes.
	 * Returns an unsubscribe function.
	 */
	readonly onDataChange?: (callback: () => void) => () => void

	/**
	 * Update the session state file (for debugging).
	 */
	readonly updateSessionFile?: (data: SessionStateData) => Promise<void>

	/**
	 * Open a note for editing.
	 */
	readonly openNote?: (notePath: string) => Promise<void>

	/**
	 * Delete an item (note or cloze).
	 */
	readonly deleteItem?: (noteId: string, clozeKey?: string) => Promise<void>

	/**
	 * Show card info in a modal.
	 */
	readonly showCardInfo?: (info: CardInfo) => void

	/**
	 * Open the stats view.
	 */
	readonly openStats?: (extractTag: string) => void

	/**
	 * Get pre-computed deck info (for API-backed platforms).
	 * If provided, the controller will use this instead of building deck tree from items.
	 */
	readonly getDeckInfo?: () => Promise<{
		decks: DeckInfo[]
		allCounts: { new: number; learning: number; due: number }
	}>
}
