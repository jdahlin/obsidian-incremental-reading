import type { DeckInfo, ItemWithState, StreakInfo, TodayStats } from '../core/types'
import type {
	DataStore,
	NotePlatform,
	Rating,
	ReviewState,
	SessionConfig,
	SessionItem,
} from '../types'
import type {
	CardInfo,
	ContentRenderInfo,
	ReviewPlatform,
	SessionStateData,
} from './ReviewPlatform'
import type {
	DeckCounts,
	ReviewPhase,
	ReviewScreenActions,
	ReviewScreenState,
	SessionStats,
} from './types'
import { formatReviewContent } from '../core/content'
import { buildDeckTree, getCountsForFolder } from '../core/decks'
import { SessionManager } from '../SessionManager'
import { buildDebugInfo, createSessionStats, determinePhase, getClozeIndex } from './utils'

/**
 * Internal model state for the review controller.
 */
interface ReviewModel {
	screen: 'folder' | 'review'
	items: ItemWithState[]
	decks: DeckInfo[]
	allCounts: DeckCounts
	selectedPath: string | null
	todayStats: TodayStats
	streak: StreakInfo
	currentSessionItem: SessionItem | null
	phase: ReviewPhase
	sessionStats: SessionStats
	currentStartedAt: Date | null
	currentContent: string
	undoState: UndoState | null
}

/**
 * State saved for undo functionality.
 */
interface UndoState {
	item: SessionItem
	previousState: ReviewState
}

type Listener = (state: ReviewScreenState) => void

/**
 * Minimal keyboard event interface for platform-agnostic handling.
 * DOM KeyboardEvent satisfies this interface.
 */
export interface KeyDownEvent {
	key: string
	defaultPrevented: boolean
	ctrlKey?: boolean
	target: { tagName?: string } | null
	preventDefault: () => void
}

const emptyCounts: DeckCounts = { new: 0, learning: 0, due: 0 }
const emptyTodayStats: TodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
const emptyStreak: StreakInfo = { current: 0, longest: 0 }

/**
 * Settings for the review controller.
 */
export interface ReviewControllerSettings {
	newCardsPerDay: number
	maximumInterval: number
	requestRetention: number
	extractTag: string
	showStreak: boolean
	strategy: 'JD1' | 'Anki'
	clumpLimit?: number
	cooldown?: number
}

/**
 * Dependencies for the review controller.
 */
export interface ReviewControllerDeps {
	platform: ReviewPlatform
	settings: ReviewControllerSettings
	dataStore: DataStore
	notePlatform: NotePlatform
}

/**
 * Platform-agnostic review controller.
 *
 * Manages the review flow state machine:
 * - Folder selection screen
 * - Question/Answer review screens
 * - Finished screen
 *
 * Platform-specific operations (rendering, modals, etc.) are delegated to the ReviewPlatform adapter.
 */
export class ReviewController {
	private listeners = new Set<Listener>()
	private unbindDataChange: (() => void) | null = null
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null
	private sessionManager: SessionManager | null = null
	private refreshRequestId = 0
	private contentRequestId = 0

	private model: ReviewModel = {
		screen: 'folder',
		items: [],
		decks: [],
		allCounts: emptyCounts,
		selectedPath: null,
		todayStats: emptyTodayStats,
		streak: emptyStreak,
		currentSessionItem: null,
		phase: 'question',
		sessionStats: createSessionStats(),
		currentStartedAt: null,
		currentContent: '',
		undoState: null,
	}

	private state!: ReviewScreenState

	constructor(private deps: ReviewControllerDeps) {
		this.state = this.buildScreenState()
	}

	/**
	 * Mount the controller - start listening for data changes.
	 */
	mount(): void {
		if (this.deps.platform.onDataChange) {
			this.unbindDataChange = this.deps.platform.onDataChange(() => {
				if (this.model.screen === 'review') return
				if (this.refreshTimeout) clearTimeout(this.refreshTimeout)
				this.refreshTimeout = setTimeout(() => {
					void this.refreshSummary()
				}, 500)
			})
		}
	}

	/**
	 * Unmount the controller - stop listening and clean up.
	 */
	unmount(): void {
		if (this.unbindDataChange) {
			this.unbindDataChange()
			this.unbindDataChange = null
		}
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
			this.refreshTimeout = null
		}
	}

	/**
	 * Subscribe to state changes.
	 * Returns an unsubscribe function.
	 */
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener)
		listener(this.state)
		return () => {
			this.listeners.delete(listener)
		}
	}

	/**
	 * Get current screen state.
	 */
	getState(): ReviewScreenState {
		return this.state
	}

	/**
	 * Get internal model (for advanced use cases).
	 */
	getModel(): Readonly<ReviewModel> {
		return this.model
	}

	/**
	 * Get all actions as an object (useful for binding to UI).
	 */
	getActions(): ReviewScreenActions {
		return {
			onSelectDeck: this.selectDeck,
			onStudy: this.startReview,
			onStats: this.openStats,
			onBack: this.backToSummary,
			onShowAnswer: this.showAnswer,
			onGrade: this.grade,
			onEdit: this.editCurrentItem,
			onSkip: this.skip,
			onUndo: this.undo,
			onSuspend: this.suspend,
			onCardInfo: this.showCardInfo,
			onDelete: this.deleteCurrentItem,
		}
	}

	/**
	 * Handle keyboard events during review.
	 */
	handleKeyDown(event: KeyDownEvent): void | Promise<void> {
		if (event.defaultPrevented) return
		const target = event.target
		if (target?.tagName && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

		if (event.key === 'Escape' && this.model.screen === 'review') {
			void this.backToSummary()
			return
		}
		if (this.model.screen !== 'review') return

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			if (this.model.phase === 'question') {
				this.showAnswer()
			} else {
				return this.grade(3) // Good
			}
			return
		}

		if (['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault()
			return this.grade(Number(event.key) as 1 | 2 | 3 | 4)
		}

		if (event.key === 'e') {
			event.preventDefault()
			this.editCurrentItem()
			return
		}

		if (event.key === 's') {
			event.preventDefault()
			this.skip()
			return
		}

		if (event.key === 'z' || (event.ctrlKey && event.key === 'z')) {
			event.preventDefault()
			this.undo()
			return
		}

		if (event.key === 'i') {
			event.preventDefault()
			this.showCardInfo()
		}
	}

	/**
	 * Refresh the folder summary screen.
	 */
	async refreshSummary(): Promise<void> {
		const requestId = ++this.refreshRequestId
		const now = new Date()

		const engineItems = await this.deps.dataStore.listItems()
		const items: ItemWithState[] = []
		for (const engineItem of engineItems) {
			const state = await this.deps.dataStore.getState(engineItem.id)
			items.push({
				id: engineItem.id,
				noteId: engineItem.noteId,
				notePath: engineItem.notePath,
				type: this.mapItemType(engineItem.type),
				clozeIndex: getClozeIndex(engineItem),
				state: state
					? {
							status: state.status,
							due: state.due,
							stability: state.stability,
							difficulty: state.difficulty,
							reps: state.reps,
							lapses: state.lapses,
							last_review: state.lastReview,
						}
					: {
							status: 'new',
							due: null,
							stability: 0,
							difficulty: 0,
							reps: 0,
							lapses: 0,
							last_review: null,
						},
				priority: engineItem.priority,
				created: engineItem.created,
			})
		}

		const decks = buildDeckTree(items, now)
		const allCounts = getCountsForFolder(items, '', now)
		const todayStats = await this.deps.platform.getTodayStats(now)
		const streak = await this.deps.platform.getStreakInfo(now)
		if (requestId !== this.refreshRequestId) return

		const selectedPath = this.deps.platform.getPreselectedPath(decks)
		this.setModel((prev) => ({
			...prev,
			screen: 'folder',
			items,
			decks,
			allCounts,
			selectedPath,
			todayStats,
			streak,
			currentSessionItem: null,
			phase: 'question',
			sessionStats: createSessionStats(),
			currentStartedAt: null,
			currentContent: '',
		}))
	}

	// ==================== Actions ====================

	/**
	 * Select a deck/folder for review.
	 */
	selectDeck = (path: string | null): void => {
		this.setModel((prev) => ({ ...prev, selectedPath: path }))
	}

	/**
	 * Start a review session.
	 */
	startReview = async (): Promise<void> => {
		const now = new Date()
		const config: SessionConfig = {
			strategy: this.deps.settings.strategy,
			mode: 'review',
			schedulerId: 'fsrs',
			schedulingParams: {
				maximumInterval: this.deps.settings.maximumInterval,
				requestRetention: this.deps.settings.requestRetention,
			},
			newCardsLimit: this.deps.settings.newCardsPerDay,
			clumpLimit: this.deps.settings.clumpLimit ?? 3,
			cooldown: this.deps.settings.cooldown ?? 5,
			deterministic: false,
		}

		this.sessionManager = new SessionManager(
			this.deps.dataStore,
			this.deps.notePlatform,
			config,
		)

		await this.sessionManager.loadPool(now, {
			folderFilter: this.model.selectedPath ?? undefined,
		})

		const currentSessionItem = await this.sessionManager.getNext(now)
		const phase = determinePhase(currentSessionItem)

		this.setModel((prev) => ({
			...prev,
			screen: 'review',
			currentSessionItem,
			phase,
			sessionStats: createSessionStats(),
			currentStartedAt: currentSessionItem ? now : null,
			currentContent: '',
		}))

		await this.loadItemContent(currentSessionItem, phase)
		await this.updateSessionFile()
	}

	/**
	 * Show the answer for the current item.
	 */
	showAnswer = (): void => {
		const si = this.model.currentSessionItem
		if (!si || this.model.phase !== 'question') return

		const type = si.item.type
		if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
			this.setModel((prev) => ({ ...prev, phase: 'answer' }))
			void this.loadItemContent(si, 'answer').then(async () => this.updateSessionFile())
		}
	}

	/**
	 * Grade the current item.
	 */
	grade = async (rating: 1 | 2 | 3 | 4): Promise<void> => {
		const si = this.model.currentSessionItem
		if (!si || !this.sessionManager) return

		if (si.item.type === 'cloze' && this.model.phase === 'question') {
			this.showAnswer()
			return
		}

		// Save undo state before grading
		const undoState: UndoState = {
			item: si,
			previousState: { ...si.state },
		}

		const now = new Date()
		await this.sessionManager.recordReview(si.item.id, rating as Rating, now)

		// Update session stats
		const engineStats = this.sessionManager.getSessionStats()
		const sessionStats: SessionStats = {
			reviewed: engineStats.reviewed,
			again: engineStats.again,
			hard: engineStats.hard,
			good: engineStats.good,
			easy: engineStats.easy,
		}
		this.setModel((prev) => ({ ...prev, sessionStats, undoState }))

		await this.advanceQueue()
	}

	/**
	 * Skip the current item (advance without grading).
	 */
	skip = (): void => {
		void this.advanceQueue()
	}

	/**
	 * Bury the current item (postpone to tomorrow).
	 */
	bury = async (): Promise<void> => {
		const si = this.model.currentSessionItem
		if (!si) return

		const tomorrow = new Date()
		tomorrow.setDate(tomorrow.getDate() + 1)
		tomorrow.setHours(0, 0, 0, 0)

		const buriedState: ReviewState = {
			...si.state,
			due: tomorrow,
		}

		await this.deps.dataStore.setState(si.item.id, buriedState)
		await this.advanceQueue()
	}

	/**
	 * Postpone the current item by a number of days.
	 */
	postpone = async (days: number): Promise<void> => {
		const si = this.model.currentSessionItem
		if (!si) return

		const futureDate = new Date()
		futureDate.setDate(futureDate.getDate() + days)

		const postponedState: ReviewState = {
			...si.state,
			due: futureDate,
		}

		await this.deps.dataStore.setState(si.item.id, postponedState)
		await this.advanceQueue()
	}

	/**
	 * Undo the last review.
	 */
	undo = (): void => {
		const undo = this.model.undoState
		if (!undo) return

		void this.deps.dataStore.setState(undo.item.item.id, undo.previousState).then(() => {
			const restoredItem: SessionItem = {
				...undo.item,
				state: undo.previousState,
			}
			const phase = determinePhase(restoredItem)

			// Decrement session stats
			const stats = { ...this.model.sessionStats }
			if (stats.reviewed > 0) stats.reviewed--

			this.setModel((prev) => ({
				...prev,
				currentSessionItem: restoredItem,
				phase,
				undoState: null,
				sessionStats: stats,
				currentStartedAt: new Date(),
				currentContent: '',
			}))

			void this.loadItemContent(restoredItem, phase)
			void this.updateSessionFile()
		})
	}

	/**
	 * Suspend the current item (set far-future due date).
	 */
	suspend = (): void => {
		const si = this.model.currentSessionItem
		if (!si) return

		const suspendedState: ReviewState = {
			...si.state,
			due: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
		}

		void this.deps.dataStore.setState(si.item.id, suspendedState).then(() => {
			void this.advanceQueue()
		})
	}

	/**
	 * Go back to the folder summary screen.
	 */
	backToSummary = async (): Promise<void> => {
		this.sessionManager = null
		await this.refreshSummary()
	}

	/**
	 * Edit the current item's note.
	 */
	editCurrentItem = (): void => {
		const si = this.model.currentSessionItem
		if (!si || !this.deps.platform.openNote) return
		void this.deps.platform.openNote(si.item.notePath)
	}

	/**
	 * Show card info for the current item.
	 */
	showCardInfo = (): void => {
		const si = this.model.currentSessionItem
		if (!si || !this.deps.platform.showCardInfo) return

		const info: CardInfo = {
			id: si.item.id,
			noteId: si.item.noteId,
			notePath: si.item.notePath,
			type: si.item.type,
			status: si.state.status,
			due: si.state.due,
			stability: si.state.stability,
			difficulty: si.state.difficulty,
			reps: si.state.reps,
			lapses: si.state.lapses,
			lastReview: si.state.lastReview,
			priority: si.item.priority,
		}

		this.deps.platform.showCardInfo(info)
	}

	/**
	 * Delete the current item.
	 */
	deleteCurrentItem = (): void => {
		const si = this.model.currentSessionItem
		if (!si || !this.deps.platform.deleteItem) return

		const parts = si.item.id.split('::')
		const noteId = parts[0] ?? ''
		const clozeKey = parts[1]

		void this.deps.platform.deleteItem(noteId, clozeKey).then(() => {
			void this.advanceQueue()
		})
	}

	/**
	 * Open the stats view.
	 */
	openStats = (): void => {
		if (this.deps.platform.openStats) {
			this.deps.platform.openStats(this.deps.settings.extractTag)
		}
	}

	// ==================== Private Helpers ====================

	private async advanceQueue(): Promise<void> {
		if (!this.sessionManager) return

		const now = new Date()
		const nextItem = await this.sessionManager.getNext(now)
		const phase = determinePhase(nextItem)

		this.setModel((prev) => ({
			...prev,
			currentSessionItem: nextItem,
			phase,
			currentStartedAt: nextItem ? new Date() : null,
			currentContent: '',
		}))

		await this.loadItemContent(nextItem, phase)
		await this.updateSessionFile()
	}

	private async loadItemContent(si: SessionItem | null, phase: ReviewPhase): Promise<void> {
		const requestId = ++this.contentRequestId
		if (!si) {
			this.setModel((prev) => ({ ...prev, currentContent: '' }))
			return
		}

		const renderInfo: ContentRenderInfo = {
			id: si.item.id,
			noteId: si.item.noteId,
			notePath: si.item.notePath,
			type: si.item.type,
			clozeIndex: getClozeIndex(si.item),
			phase,
		}

		const html = await this.deps.platform.getContent(renderInfo, this.deps.settings.extractTag)
		if (requestId !== this.contentRequestId) return
		this.setModel((prev) => ({ ...prev, currentContent: html }))
	}

	private emit(): void {
		this.state = this.buildScreenState()
		for (const listener of this.listeners) {
			listener(this.state)
		}
	}

	private setModel(update: ReviewModel | ((prev: ReviewModel) => ReviewModel)): void {
		this.model = typeof update === 'function' ? update(this.model) : update
		this.emit()
	}

	private buildScreenState(): ReviewScreenState {
		if (this.model.screen === 'folder') {
			return {
				type: 'folder',
				decks: this.model.decks,
				selectedPath: this.model.selectedPath,
				allCounts: this.model.allCounts,
				todayStats: this.model.todayStats,
				streak: this.model.streak,
				showStreak: this.deps.settings.showStreak,
			}
		}

		if (!this.model.currentSessionItem) {
			return { type: 'finished', sessionStats: this.model.sessionStats }
		}

		const si = this.model.currentSessionItem
		const debugInfo = buildDebugInfo(si)
		const canUndo = this.model.undoState !== null

		if (this.model.phase === 'question') {
			return {
				type: 'question',
				content: this.model.currentContent,
				clozeIndex: si.item.type === 'cloze' ? (si.item.clozeIndex ?? null) : null,
				debugInfo,
				canUndo,
			}
		}

		return { type: 'answer', content: this.model.currentContent, debugInfo, canUndo }
	}

	private mapItemType(type: string): ItemWithState['type'] {
		const typeMap: Record<string, ItemWithState['type']> = {
			topic: 'topic',
			cloze: 'item',
			basic: 'basic',
			image_occlusion: 'image_occlusion',
		}
		return typeMap[type] ?? 'item'
	}

	private async updateSessionFile(): Promise<void> {
		if (!this.deps.platform.updateSessionFile) return

		const now = new Date()
		const queueCounts = this.sessionManager
			? await this.getQueueCounts(now)
			: { new: 0, learning: 0, due: 0, total: 0 }

		let rawMarkdown: string | null = null
		let formattedMarkdown: string | null = null

		const si = this.model.currentSessionItem
		if (si) {
			rawMarkdown = await this.deps.notePlatform.getNote(si.item.noteId)
			if (rawMarkdown !== null) {
				formattedMarkdown = formatReviewContent(
					rawMarkdown,
					si.item.type,
					this.model.phase,
					getClozeIndex(si.item),
				)
			}
		}

		const data: SessionStateData = {
			deck: this.model.selectedPath,
			currentItem: si
				? {
						id: si.item.id,
						noteId: si.item.noteId,
						notePath: si.item.notePath,
						type: si.item.type,
						clozeIndex: getClozeIndex(si.item),
						phase: this.model.phase,
						rawMarkdown,
						formattedMarkdown,
					}
				: null,
			queue: queueCounts,
			session: {
				startedAt: this.model.currentStartedAt?.toISOString() ?? null,
				reviewed: this.model.sessionStats.reviewed,
				again: this.model.sessionStats.again,
				hard: this.model.sessionStats.hard,
				good: this.model.sessionStats.good,
				easy: this.model.sessionStats.easy,
			},
			lastError: null,
			updatedAt: new Date().toISOString(),
		}

		await this.deps.platform.updateSessionFile(data)
	}

	private async getQueueCounts(
		now: Date,
	): Promise<{ new: number; learning: number; due: number; total: number }> {
		if (!this.sessionManager) {
			return { new: 0, learning: 0, due: 0, total: 0 }
		}

		const items = await this.sessionManager.getNextN(10000)
		let newCount = 0
		let learningCount = 0
		let dueCount = 0

		for (const item of items) {
			if (item.state.status === 'new') {
				newCount++
			} else if (item.state.status === 'learning' || item.state.status === 'relearning') {
				learningCount++
			} else if (item.state.due && item.state.due <= now) {
				dueCount++
			}
		}

		return {
			new: newCount,
			learning: learningCount,
			due: dueCount,
			total: items.length,
		}
	}
}
