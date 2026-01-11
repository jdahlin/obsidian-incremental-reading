// Re-export shared types from canonical source
import type { DeckInfo, ItemState, Rating, Status } from '../types'
export type { DeckInfo, ItemState, Rating, Status } from '../types'

// CardType differs from ItemType: uses 'item' (legacy) instead of 'cloze'
export type CardType = 'topic' | 'item' | 'basic' | 'image_occlusion'

/**
 * Review item with embedded scheduling state.
 * Used for UI rendering and statistics where item + state are needed together.
 * Distinct from types.ts ReviewItem which separates item metadata from state.
 */
export interface ItemWithState {
	id: string
	noteId: string
	notePath: string
	noteFile?: unknown
	type: CardType
	clozeIndex?: number | null
	state: ItemState
	priority: number
	created?: Date | null
}

export interface ReviewPlatformAdapter {
	getTodayStats: (now: Date) => Promise<TodayStats>
	getStreakInfo: (now: Date) => Promise<StreakInfo>
	renderItem: (
		item: ItemWithState,
		phase: 'question' | 'answer',
		extractTag: string,
	) => Promise<string>
	openStats: (extractTag: string) => void
	getPreselectedPath: (decks: DeckInfo[]) => string | null
	onDataChange: (handler: () => void) => () => void
}

export interface NoteFrontmatter {
	ir_note_id: string
	tags: string[]
	source?: string
	type: CardType
	created?: Date | null
	priority: number
}

export interface ReviewRecord {
	ts: string
	item_id: string
	rating: Rating
	elapsed_ms?: number
	state_before?: Status
	stability_before?: number
	difficulty_before?: number
}

export interface TodayStats {
	reviewed: number
	again: number
	hard: number
	good: number
	easy: number
}

export interface StreakInfo {
	current: number
	longest: number
}
