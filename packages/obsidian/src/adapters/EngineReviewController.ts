import type { DeepReadonly } from '@repo/core/core/readonly'
import type {
	ItemWithState as CoreReviewItem,
	DeckInfo,
	ItemState,
	ReviewPlatformAdapter,
	StreakInfo,
	TodayStats,
} from '@repo/core/core/types'
import type {
	DataStore,
	NotePlatform,
	Rating,
	ReviewItem,
	ReviewState,
	SessionConfig,
	SessionItem,
} from '@repo/core/types'
import type { SessionStateData } from '../data/session'
import type { ReviewPhase } from '../review/content'
import type { DeckCountsValue } from '../review/deck-summary-types'
import type {
	DebugInfo,
	QueueName,
	ReviewScreenActions,
	ReviewScreenState,
	ReviewViewState,
} from '../review/review-screen-state'
import type { SessionStats as UISessionStats } from '../review/review-screen-types'
import { formatReviewContent } from '@repo/core/core/content'
import { buildDeckTree, getCountsForFolder } from '@repo/core/core/decks'
import { SessionManager } from '@repo/core/SessionManager'
import { buildSessionState } from '../data/session'

/** Get clozeIndex from a ReviewItem, or null if not applicable */
function getClozeIndex(item: DeepReadonly<ReviewItem>): number | null {
	if (item.type === 'cloze' || item.type === 'image_occlusion') {
		return item.clozeIndex
	}
	return null
}

/** Extended platform adapter with optional session state support */
interface ExtendedPlatformAdapter extends ReviewPlatformAdapter {
	updateSessionState?: DeepReadonly<(data: DeepReadonly<SessionStateData>) => Promise<void>>
	openNote?: DeepReadonly<(notePath: string) => Promise<void>>
	deleteItem?: DeepReadonly<(noteId: string, clozeKey?: string) => Promise<void>>
	showCardInfo?: DeepReadonly<(info: DeepReadonly<CardInfo>) => void>
}

export interface CardInfo {
	id: string
	noteId: string
	notePath: string
	type: string
	status: string
	due: Date | null
	stability: number
	difficulty: number
	reps: number
	lapses: number
	lastReview: Date | null
	priority: number
}

export interface EngineReviewSettings {
	newCardsPerDay: number
	maximumInterval: number
	requestRetention: number
	extractTag: string
	trackReviewTime: boolean
	showStreak: boolean
	strategy: 'JD1' | 'Anki'
	clumpLimit?: number
	cooldown?: number
}

export interface EngineReviewControllerDeps {
	platform: ExtendedPlatformAdapter
	settings: EngineReviewSettings
	dataStore: DataStore
	notePlatform: NotePlatform
}

interface UndoState {
	item: SessionItem
	previousState: ReviewState
}

interface EngineReviewModel {
	screen: 'folder' | 'review'
	items: CoreReviewItem[]
	decks: DeckInfo[]
	allCounts: DeckCountsValue
	selectedPath: string | null
	todayStats: TodayStats
	streak: StreakInfo
	currentSessionItem: SessionItem | null
	phase: ReviewPhase
	sessionStats: UISessionStats
	currentStartedAt: Date | null
	currentContent: string
	undoState: UndoState | null
}

type Listener = (state: DeepReadonly<ReviewScreenState>) => void

const emptyCounts: DeckCountsValue = { new: 0, learning: 0, due: 0 }
const emptyTodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
const emptyStreak = { current: 0, longest: 0 }

function createSessionStats(): UISessionStats {
	return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
}

/**
 * Engine-powered review controller using SessionManager for advanced queue logic.
 * Provides JD1 strategy, volatile queue, clump limiting, and linked note affinity.
 */
export class EngineReviewController {
	private listeners = new Set<Listener>()
	private unbindDataChange: (() => void) | null = null
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null
	private sessionManager: SessionManager | null = null
	private static readonly SPACE_GRADE: 1 | 2 | 3 | 4 = 3

	/** Callback to trigger Obsidian's navigation history recording, passing the state to record */
	onHistoryChange: ((stateToRecord: DeepReadonly<ReviewViewState>) => void) | null = null

	/** Track if we're currently restoring state (to avoid re-recording history) */
	private isRestoring = false

	/** State snapshot before current grade (for re-grading support) */
	private stateBeforeGrade: ReviewState | null = null
	private model: EngineReviewModel = {
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

	private state: ReviewScreenState = this.buildScreenState()
	private refreshRequestId = 0
	private contentRequestId = 0

	constructor(private deps: DeepReadonly<EngineReviewControllerDeps>) {}

	mount(): void {
		this.unbindDataChange = this.deps.platform.onDataChange(() => {
			if (this.model.screen === 'review') return
			if (this.refreshTimeout) clearTimeout(this.refreshTimeout)
			this.refreshTimeout = setTimeout(() => {
				void this.refreshSummary()
			}, 500)
		})
	}

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

	subscribe(listener: DeepReadonly<Listener>): () => void {
		this.listeners.add(listener)
		listener(this.state)
		return () => {
			this.listeners.delete(listener)
		}
	}

	getState(): ReviewScreenState {
		return this.state
	}

	getModel(): Readonly<EngineReviewModel> {
		return this.model
	}

	getActions(): ReviewScreenActions {
		return {
			onSelectDeck: this.onSelectDeck,
			onStudy: this.onStudy,
			onStats: this.onStats,
			onBack: this.onBack,
			onShowAnswer: this.onShowAnswer,
			onGrade: this.onGrade,
			onEdit: this.onEdit,
			onSkip: this.onSkip,
			onUndo: this.onUndo,
			onSuspend: this.onSuspend,
			onCardInfo: this.onCardInfo,
			onDelete: this.onDelete,
		}
	}

	/**
	 * Keyboard shortcuts for review. Check order matters:
	 * 1. Skip if already handled (defaultPrevented)
	 * 2. Skip if typing in input/textarea (preserve text entry)
	 * 3. Escape always works (back to folder view)
	 * 4. Other shortcuts only in review screen
	 */
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- KeyboardEvent is a DOM type
	handleKeyDown(event: KeyboardEvent): void | Promise<void> {
		if (event.defaultPrevented) return
		const target = event.target as HTMLElement | null
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

		if (event.key === 'Escape' && this.model.screen === 'review') {
			event.preventDefault()
			event.stopImmediatePropagation()
			void this.onBack()
			return
		}
		if (this.model.screen !== 'review') return

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			event.stopImmediatePropagation()
			if (this.model.phase === 'question') {
				this.onShowAnswer()
			} else {
				return this.onGrade(EngineReviewController.SPACE_GRADE)
			}
			return
		}

		if (['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault()
			event.stopImmediatePropagation()
			return this.onGrade(Number(event.key))
		}

		// More menu keyboard shortcuts
		if (event.key === 'e') {
			event.preventDefault()
			event.stopImmediatePropagation()
			this.onEdit()
			return
		}

		if (event.key === 's') {
			event.preventDefault()
			event.stopImmediatePropagation()
			this.onSkip()
			return
		}

		if (event.key === 'z' || (event.ctrlKey && event.key === 'z')) {
			event.preventDefault()
			event.stopImmediatePropagation()
			this.onUndo()
			return
		}

		if (event.key === 'i') {
			event.preventDefault()
			event.stopImmediatePropagation()
			this.onCardInfo()
		}
	}

	async refreshSummary(): Promise<void> {
		const requestId = ++this.refreshRequestId
		const now = new Date()

		// Use dataStore directly to get all items (no tag filtering)
		const engineItems = await this.deps.dataStore.listItems()
		const items: CoreReviewItem[] = []
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
		this.setModel(
			(prev) =>
				({
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
				}) as EngineReviewModel,
		)
	}

	async startReview(): Promise<void> {
		// Record folder screen state in history before starting review
		// This allows navigating back to the folder selection
		const folderState = this.getSerializableState()
		this.recordHistory(folderState)

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

		// Create SessionManager
		this.sessionManager = new SessionManager(
			this.deps.dataStore,
			this.deps.notePlatform,
			config,
		)

		// Load pool with folder filter
		await this.sessionManager.loadPool(now, {
			folderFilter: this.model.selectedPath ?? undefined,
		})

		// Get first item
		const currentSessionItem = await this.sessionManager.getNext(now)
		const phase = this.determinePhase(currentSessionItem)

		this.setModel(
			(prev) =>
				({
					...prev,
					screen: 'review',
					currentSessionItem,
					phase,
					sessionStats: createSessionStats(),
					currentStartedAt: currentSessionItem ? now : null,
					currentContent: '',
				}) as EngineReviewModel,
		)

		await this.loadItemContent(currentSessionItem, phase)
		await this.updateSessionFile()
	}

	/**
	 * Grades the current item and advances the queue.
	 *
	 * CRITICAL: undo state must be captured BEFORE recordReview() because:
	 * - recordReview() persists the new state to sidecar files
	 * - undo needs the previous state to restore
	 * - The shallow copy {...si.state} captures the pre-grade values
	 */
	async gradeCurrentItem(grade: number): Promise<void> {
		const si = this.model.currentSessionItem
		if (!si || !this.sessionManager) return

		if (si.item.type === 'cloze' && this.model.phase === 'question') {
			this.showAnswer()
			return
		}

		// Capture current state BEFORE grading (for history)
		const stateToRecord = this.getSerializableState()

		// Capture undo state BEFORE grading - this is the state we'll restore on undo
		const undoState: UndoState = {
			item: si,
			previousState: { ...si.state },
		}

		// Save state before grading for re-grade support
		this.stateBeforeGrade = structuredClone(si.state)

		const now = new Date()
		const rating = grade as Rating

		// This persists to disk and mutates session manager state
		await this.sessionManager.recordReview(si.item.id, rating, now)

		// Update session stats
		const engineStats = this.sessionManager.getSessionStats()
		const sessionStats: UISessionStats = {
			reviewed: engineStats.reviewed,
			again: engineStats.again,
			hard: engineStats.hard,
			good: engineStats.good,
			easy: engineStats.easy,
		}
		this.setModel((prev) => ({ ...prev, sessionStats, undoState }) as EngineReviewModel)

		await this.advanceQueue()

		// Record history AFTER advancing (so getState returns new state but we record old state)
		this.recordHistory(stateToRecord)
	}

	private determinePhase(si: DeepReadonly<SessionItem> | null): ReviewPhase {
		if (!si) return 'question'
		// Cloze and basic cards start with question phase
		// Topic cards go directly to answer (show full content)
		const type = si.item.type
		if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
			return 'question'
		}
		return 'answer'
	}

	private async loadItemContent(
		si: DeepReadonly<SessionItem> | null,
		phase: ReviewPhase,
	): Promise<void> {
		const requestId = ++this.contentRequestId
		if (!si) {
			this.setModel((prev) => ({ ...prev, currentContent: '' }) as EngineReviewModel)
			return
		}

		// Convert SessionItem to CoreReviewItem for platform adapter
		const coreItem = this.sessionItemToCoreItem(si)
		const html = await this.deps.platform.renderItem(
			coreItem,
			phase,
			this.deps.settings.extractTag,
		)
		if (requestId !== this.contentRequestId) return
		this.setModel((prev) => ({ ...prev, currentContent: html }) as EngineReviewModel)
	}

	private async backToSummary(): Promise<void> {
		// Don't record history when exiting review - this clears the session
		this.sessionManager = null
		this.stateBeforeGrade = null
		await this.refreshSummary()
	}

	private showAnswer(): void {
		const si = this.model.currentSessionItem
		if (!si || this.model.phase !== 'question') return

		const type = si.item.type
		if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
			this.setModel((prev) => ({ ...prev, phase: 'answer' }) as EngineReviewModel)
			void this.loadItemContent(si, 'answer').then(async () => this.updateSessionFile())
		}
	}

	private async advanceQueue(): Promise<void> {
		if (!this.sessionManager) return

		const now = new Date()
		const nextItem = await this.sessionManager.getNext(now)
		const phase = this.determinePhase(nextItem)

		this.setModel(
			(prev) =>
				({
					...prev,
					currentSessionItem: nextItem,
					phase,
					currentStartedAt: nextItem ? new Date() : null,
					currentContent: '',
				}) as EngineReviewModel,
		)

		await this.loadItemContent(nextItem, phase)
		await this.updateSessionFile()
	}

	private emit(): void {
		this.state = this.buildScreenState()
		for (const listener of this.listeners) {
			listener(this.state)
		}
	}

	private setModel(
		update:
			| DeepReadonly<EngineReviewModel>
			| ((prev: DeepReadonly<EngineReviewModel>) => EngineReviewModel),
	): void {
		this.model = (
			typeof update === 'function' ? update(this.model) : update
		) as EngineReviewModel
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
		const debugInfo: DebugInfo = {
			queue: this.getQueueName(si.state.status),
			status: si.state.status,
			priority: si.item.priority,
			due: si.state.due?.toISOString() ?? null,
			stability: si.state.stability,
			difficulty: si.state.difficulty,
			reps: si.state.reps,
			lapses: si.state.lapses,
		}

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

	private getQueueName(status: string): QueueName {
		if (status === 'new') return 'new'
		if (status === 'learning' || status === 'relearning') return 'learning'
		return 'review'
	}

	private sessionItemToCoreItem(si: DeepReadonly<SessionItem>): CoreReviewItem {
		return {
			id: si.item.id,
			noteId: si.item.noteId,
			notePath: si.item.notePath,
			type: this.mapItemType(si.item.type),
			clozeIndex: getClozeIndex(si.item),
			state: this.reviewStateToItemState(si.state),
			priority: si.item.priority,
			created: si.item.created,
		}
	}

	/** Map ItemType to CardType, preserving basic and image_occlusion */
	private mapItemType(type: string): CoreReviewItem['type'] {
		const typeMap: Record<string, CoreReviewItem['type']> = {
			topic: 'topic',
			cloze: 'item',
			basic: 'basic',
			image_occlusion: 'image_occlusion',
		}
		return typeMap[type] ?? 'item'
	}

	private reviewStateToItemState(state: DeepReadonly<ReviewState>): ItemState {
		return {
			status: state.status,
			due: state.due,
			stability: state.stability,
			difficulty: state.difficulty,
			reps: state.reps,
			lapses: state.lapses,
			last_review: state.lastReview,
		}
	}

	private async updateSessionFile(): Promise<void> {
		if (!this.deps.platform.updateSessionState) return

		const now = new Date()
		const queueCounts = this.sessionManager
			? await this.getQueueCounts(now)
			: { new: 0, learning: 0, due: 0, total: 0 }

		// Get raw and formatted markdown for debugging
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

		const data = buildSessionState({
			deck: this.model.selectedPath,
			currentItem: this.model.currentSessionItem,
			phase: this.model.phase,
			queueCounts,
			sessionStats: this.model.sessionStats,
			startedAt: this.model.currentStartedAt,
			rawMarkdown,
			formattedMarkdown,
		})

		await this.deps.platform.updateSessionState(data)
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

	private readonly onSelectDeck = (path: string | null): void => {
		this.setModel((prev) => ({ ...prev, selectedPath: path }) as EngineReviewModel)
	}

	private readonly onStudy = (): void => {
		void this.startReview()
	}

	private readonly onStats = (): void => {
		this.deps.platform.openStats(this.deps.settings.extractTag)
	}

	private readonly onBack = (): void => {
		void this.backToSummary()
	}

	private readonly onShowAnswer = (): void => {
		this.showAnswer()
	}

	private readonly onGrade = async (grade: number): Promise<void> => {
		await this.gradeCurrentItem(grade)
	}

	private readonly onEdit = (): void => {
		const si = this.model.currentSessionItem
		if (!si) return
		if (this.deps.platform.openNote) {
			void this.deps.platform.openNote(si.item.notePath)
		}
	}

	private readonly onSkip = (): void => {
		// Skip without grading - just advance to next card
		void this.advanceQueue()
	}

	private readonly onUndo = (): void => {
		const undo = this.model.undoState
		if (!undo) return

		// Restore the previous state
		void this.deps.dataStore.setState(undo.item.item.id, undo.previousState).then(() => {
			// Set current item back to the undone card
			const restoredItem: SessionItem = {
				...undo.item,
				state: undo.previousState,
			}
			const phase = this.determinePhase(restoredItem)

			// Decrement session stats
			const stats = { ...this.model.sessionStats }
			if (stats.reviewed > 0) stats.reviewed--

			this.setModel(
				(prev) =>
					({
						...prev,
						currentSessionItem: restoredItem,
						phase,
						undoState: null,
						sessionStats: stats,
						currentStartedAt: new Date(),
						currentContent: '',
					}) as EngineReviewModel,
			)

			void this.loadItemContent(restoredItem, phase)
			void this.updateSessionFile()
		})
	}

	private readonly onSuspend = (): void => {
		const si = this.model.currentSessionItem
		if (!si) return

		// Set a far-future due date to effectively suspend the card
		const suspendedState: ReviewState = {
			...si.state,
			due: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years from now
		}

		void this.deps.dataStore.setState(si.item.id, suspendedState).then(() => {
			void this.advanceQueue()
		})
	}

	private readonly onCardInfo = (): void => {
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

	private readonly onDelete = (): void => {
		const si = this.model.currentSessionItem
		if (!si) return

		if (this.deps.platform.deleteItem) {
			// Parse the item ID to get noteId and optional clozeKey
			const parts = si.item.id.split('::')
			const noteId = parts[0] ?? ''
			const clozeKey = parts[1]

			void this.deps.platform.deleteItem(noteId, clozeKey).then(() => {
				void this.advanceQueue()
			})
		}
	}

	/**
	 * Get serializable state for Obsidian's navigation history.
	 */
	getSerializableState(): ReviewViewState {
		if (this.model.screen === 'folder') {
			return {
				screen: 'folder',
				selectedPath: this.model.selectedPath,
			}
		}

		const si = this.model.currentSessionItem
		if (!si) {
			return { screen: 'folder' }
		}

		return {
			screen: 'review',
			itemId: si.item.id,
			phase: this.model.phase,
			content: this.model.currentContent,
			stateBefore: this.stateBeforeGrade ?? undefined,
			grade: null,
		}
	}

	/**
	 * Restore state from Obsidian's navigation history.
	 */
	async restoreState(state: DeepReadonly<ReviewViewState>): Promise<void> {
		this.isRestoring = true
		try {
			if (state.screen === 'folder') {
				// Restore to folder screen - need to refresh data
				this.sessionManager = null
				this.stateBeforeGrade = null
				await this.refreshSummary()
				if (state.selectedPath !== undefined) {
					this.setModel(
						(prev) =>
							({
								...prev,
								selectedPath: state.selectedPath ?? null,
							}) as EngineReviewModel,
					)
				}
				return
			}

			// Restoring to a review screen
			if (state.itemId === undefined || state.itemId === null || state.itemId === '') {
				return
			}

			// If we don't have a session, we can't restore review state
			if (!this.sessionManager) {
				// Start a new session and try to find the item
				await this.startReview()
			}

			// Find the item from the list
			const allItems = await this.deps.dataStore.listItems()
			const item = allItems.find((i) => i.id === state.itemId)
			if (!item) {
				return
			}

			const reviewState = await this.deps.dataStore.getState(state.itemId)
			const sessionItem: SessionItem = {
				item,
				state: reviewState ?? {
					status: 'new',
					due: null,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					lastReview: null,
				},
				score: 0, // Score is not relevant for restored items
			}

			// Store the state before for re-grading support
			this.stateBeforeGrade = state.stateBefore ?? structuredClone(sessionItem.state)

			const phase = state.phase ?? this.determinePhase(sessionItem)

			this.setModel(
				(prev) =>
					({
						...prev,
						screen: 'review',
						currentSessionItem: sessionItem,
						phase,
						currentContent: state.content ?? '',
					}) as EngineReviewModel,
			)

			// If content wasn't stored, reload it
			if (state.content === undefined || state.content === null || state.content === '') {
				await this.loadItemContent(sessionItem, phase)
			}
		} finally {
			this.isRestoring = false
		}
	}

	/**
	 * Record a state in navigation history.
	 * @param stateToRecord The state to record in history (typically the previous state before a transition)
	 */
	private recordHistory(stateToRecord: DeepReadonly<ReviewViewState>): void {
		if (!this.isRestoring && this.onHistoryChange) {
			this.onHistoryChange(stateToRecord)
		}
	}
}
