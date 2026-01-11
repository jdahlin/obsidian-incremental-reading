import type { DeckInfo, StreakInfo, TodayStats } from '@repo/core/core/types'
import type { ReviewState } from '@repo/core/types'
import type { ReviewPhase } from './content'
import type { DeckCountsValue } from './deck-summary-types'
import type { SessionStats } from './review-screen-types'

/**
 * Serializable state for Obsidian's navigation history.
 * This is stored by Obsidian when navigating between states.
 * Must be compatible with Record<string, unknown> for Obsidian's API.
 */
export interface ReviewViewState {
	[key: string]: unknown
	screen: 'folder' | 'review'
	// For folder screen
	selectedPath?: string | null
	// For review screen
	itemId?: string
	phase?: ReviewPhase
	content?: string
	// Snapshot for re-grading support
	stateBefore?: ReviewState
	grade?: number | null
}

export interface DebugInfo {
	queue: string
	status: string
	priority: number
	due: string | null
	stability: number
	difficulty: number
	reps: number
	lapses: number
}

export type ReviewScreenState =
	| {
			type: 'folder'
			decks: DeckInfo[]
			selectedPath: string | null
			allCounts: DeckCountsValue
			todayStats: TodayStats
			streak: StreakInfo
			showStreak: boolean
	  }
	| {
			type: 'question'
			content: string
			clozeIndex: number | null
			debugInfo: DebugInfo
			canUndo: boolean
	  }
	| {
			type: 'answer'
			content: string
			debugInfo: DebugInfo
			canUndo: boolean
	  }
	| {
			type: 'finished'
			sessionStats: SessionStats
	  }

export interface ReviewScreenActions {
	onSelectDeck: (path: string | null) => void
	onStudy: () => void
	onStats: () => void
	onBack: () => void
	onShowAnswer: () => void
	onGrade: (grade: number) => void | Promise<void>
	onEdit: () => void
	onSkip: () => void
	onUndo: () => void
	onSuspend: () => void
	onCardInfo: () => void
	onDelete: () => void
}
