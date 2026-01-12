import type { ReviewPhase } from '../core/content'
import type { DeckInfo, StreakInfo, TodayStats } from '../core/types'
import type { Rating, ReviewState, Status } from '../types'

// Re-export ReviewPhase and Rating for convenience
export type { ReviewPhase } from '../core/content'
export type { Rating } from '../types'

/**
 * Queue name for display purposes.
 */
export type QueueName = 'new' | 'learning' | 'review'

/**
 * Counts of items by queue type for a deck.
 */
export interface DeckCounts {
	readonly new: number
	readonly learning: number
	readonly due: number
}

/**
 * Session statistics tracking review outcomes.
 */
export interface SessionStats {
	readonly reviewed: number
	readonly again: number
	readonly hard: number
	readonly good: number
	readonly easy: number
}

/**
 * Debug information for the current review item.
 */
export interface DebugInfo {
	readonly queue: QueueName
	readonly status: Status
	readonly priority: number
	readonly due: string | null
	readonly stability: number
	readonly difficulty: number
	readonly reps: number
	readonly lapses: number
}

/**
 * State for the folder selection screen.
 */
export interface FolderScreenState {
	readonly type: 'folder'
	readonly decks: readonly DeckInfo[]
	readonly selectedPath: string | null
	readonly allCounts: DeckCounts
	readonly todayStats: TodayStats
	readonly streak: StreakInfo
	readonly showStreak: boolean
}

/**
 * State for the question phase of review.
 */
export interface QuestionScreenState {
	readonly type: 'question'
	readonly content: string
	readonly clozeIndex: number | null
	readonly debugInfo: DebugInfo
	readonly canUndo: boolean
}

/**
 * State for the answer phase of review.
 */
export interface AnswerScreenState {
	readonly type: 'answer'
	readonly content: string
	readonly debugInfo: DebugInfo
	readonly canUndo: boolean
}

/**
 * State for the finished screen after completing reviews.
 */
export interface FinishedScreenState {
	readonly type: 'finished'
	readonly sessionStats: SessionStats
}

/**
 * Union type representing all possible review screen states.
 */
export type ReviewScreenState =
	| FolderScreenState
	| QuestionScreenState
	| AnswerScreenState
	| FinishedScreenState

/**
 * Actions available during review.
 */
export interface ReviewScreenActions {
	readonly onSelectDeck: (path: string | null) => void
	readonly onStudy: () => void | Promise<void>
	readonly onStats: () => void
	readonly onBack: () => void | Promise<void>
	readonly onShowAnswer: () => void
	readonly onGrade: (grade: Rating) => void | Promise<void>
	readonly onEdit: () => void
	readonly onSkip: () => void
	readonly onUndo: () => void
	readonly onSuspend: () => void
	readonly onCardInfo: () => void
	readonly onDelete: () => void
}

/**
 * Screen type for navigation state.
 */
export type ReviewScreenType = 'folder' | 'review'

/**
 * Serializable state for navigation history.
 * The index signature is required for compatibility with Obsidian's ItemView.getState().
 */
export interface ReviewViewState {
	readonly [key: string]: unknown
	readonly screen: ReviewScreenType
	readonly selectedPath?: string | null
	readonly itemId?: string
	readonly phase?: ReviewPhase
	readonly content?: string
	readonly stateBefore?: ReviewState
	readonly grade?: Rating | null
}
