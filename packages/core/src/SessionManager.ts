import type { SessionStrategy, StrategyContext } from './strategies/types'
import type {
	DataStore,
	NotePlatform,
	Rating,
	ReviewItem,
	ReviewState,
	SessionConfig,
	SessionItem,
	SessionStats,
} from './types'
import { assertNever } from './core/assert'
import { getScheduler, TopicScheduler } from './scheduling'
import { AnkiStrategy } from './strategies/AnkiStrategy'
import { JD1Strategy } from './strategies/JD1Strategy'

export interface LoadPoolOptions {
	folderFilter?: string
}

/**
 * Manages the review session state including item selection and scheduling.
 *
 * Queue invariants:
 * - pool: all items eligible for review (never mutated during session except state updates)
 * - volatileQueue: items rated "again" that are cooling down before re-entry
 * - historyIds: ordered list of reviewed item IDs (append-only within session)
 * - An item can be in pool AND volatileQueue simultaneously (volatileQueue is subset filter)
 * - availablePool = pool - historyIds - volatileQueue (computed, not stored)
 */
export class SessionManager {
	private pool: SessionItem[] = []
	/** Items marked "again" waiting for cooldown period before re-presentation */
	private volatileQueue: SessionItem[] = []
	/** Ordered review history for cooldown calculation. Index position matters. */
	private historyIds: string[] = []
	private lastNoteId: string | null = null
	private seed: number = Date.now()
	private sessionStats: SessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }

	constructor(
		private dataStore: DataStore,
		private notePlatform: NotePlatform,
		private config: SessionConfig,
	) {}

	setConfig(config: SessionConfig): void {
		this.config = config
	}

	async loadPool(now: Date = new Date(), options?: LoadPoolOptions): Promise<void> {
		let items = await this.dataStore.listItems()

		// Apply folder filtering
		if (options?.folderFilter !== undefined && options.folderFilter !== '') {
			items = this.filterByFolder(items, options.folderFilter)
		}

		const scheduler = getScheduler(
			this.config.schedulerId ?? 'fsrs',
			this.config.schedulingParams,
		)

		let sessionItems: SessionItem[] = []
		for (const item of items) {
			let state: ReviewState | null = await this.dataStore.getState(item.id)
			if (!state) {
				state = this.getInitialState()
			}

			// Apply exam adjustment if configured
			if (this.config.examDate && scheduler.applyExamAdjustment) {
				state = scheduler.applyExamAdjustment(state, this.config.examDate, now)
			}

			sessionItems.push({
				item,
				state,
				score: 0,
			})
		}

		// Apply new cards limit
		if (this.config.newCardsLimit != null) {
			const newItems = sessionItems.filter((si) => si.state.status === 'new')
			const limitedNew = newItems.slice(0, this.config.newCardsLimit)
			const limitedNewIds = new Set(limitedNew.map((si) => si.item.id))
			sessionItems = sessionItems.filter(
				(si) => si.state.status !== 'new' || limitedNewIds.has(si.item.id),
			)
		}

		this.pool = sessionItems
	}

	async getNext(now: Date = new Date()): Promise<SessionItem | null> {
		const candidates = await this.getRankedCandidates(now)
		if (candidates.length === 0) return null

		// Probabilistic interleaving for JD1 (80/20 rule)
		// 80% of the time: pick the highest-scored item (candidates[0])
		// 20% of the time: randomly pick from remaining items to add variety
		// This prevents "tunnel vision" on high-priority items while maintaining focus
		if (this.config.strategy === 'JD1' && candidates.length > 1 && !this.config.deterministic) {
			const rand = Math.random()
			if (rand > 0.8) {
				const index = 1 + Math.floor(Math.random() * (candidates.length - 1))
				return candidates[index] ?? null
			}
		}

		return candidates[0] ?? null
	}

	async getNextN(n: number, now: Date = new Date()): Promise<SessionItem[]> {
		const candidates = await this.getRankedCandidates(now)
		return candidates.slice(0, n)
	}

	private async getRankedCandidates(now: Date): Promise<SessionItem[]> {
		if (this.pool.length === 0) return []

		const strategy = this.getStrategy()
		const linkedNoteIds =
			this.lastNoteId !== null
				? new Set(await this.notePlatform.getLinks(this.lastNoteId))
				: new Set<string>()

		const context: StrategyContext = {
			lastNoteId: this.lastNoteId,
			linkedNoteIds,
			now,
			seed: this.seed,
		}

		// Filter out items in history or currently being cooled down
		const availablePool = this.pool.filter(
			(si) =>
				!this.historyIds.includes(si.item.id) &&
				!this.volatileQueue.some((v) => v.item.id === si.item.id),
		)

		if (availablePool.length === 0 && this.volatileQueue.length === 0) return []

		// Check volatileQueue for items that passed cooldown.
		// Cooldown = number of OTHER items that must be reviewed before this item reappears.
		// itemsSince = (historyLength - 1) - lastIndex = count of reviews after this item's last review.
		// If item never reviewed (not in history), it's immediately ready.
		const readyFromVolatile = this.volatileQueue.filter((si) => {
			const indexInHistory = this.historyIds.lastIndexOf(si.item.id)
			if (indexInHistory === -1) return true
			const itemsSince = this.historyIds.length - 1 - indexInHistory
			return itemsSince >= (this.config.cooldown ?? 5)
		})

		let candidates = strategy.rank(
			[...availablePool, ...readyFromVolatile],
			this.config,
			context,
		)

		// Apply clump limit: max 3 clozes per note in a row
		candidates = this.applyClumpLimit(candidates)

		return candidates
	}

	/**
	 * Records a review and updates all state. Order of operations matters:
	 * 1. Capture pre-grade state (for audit log)
	 * 2. Update volatile queue (again→add, graduate→remove)
	 * 3. Compute and persist new state
	 * 4. Append to review log with OLD state values
	 * 5. Update session stats and history
	 */
	async recordReview(itemId: string, rating: Rating, now: Date = new Date()): Promise<void> {
		const si = this.pool.find((p) => p.item.id === itemId)
		if (!si) return

		// Topics use fixed intervals; clozes use FSRS with stability/difficulty tracking
		const scheduler =
			si.item.type === 'topic'
				? new TopicScheduler()
				: getScheduler(this.config.schedulerId ?? 'fsrs', this.config.schedulingParams)

		if (rating === 1) {
			// Again: add to volatile queue for cooldown before re-presentation
			if (!this.volatileQueue.some((v) => v.item.id === itemId)) {
				this.volatileQueue.push(si)
			}
		} else {
			// Ratings 2-4 graduate from volatile queue
			this.volatileQueue = this.volatileQueue.filter((v) => v.item.id !== itemId)
		}

		// Capture BEFORE grading - these go in the review log for analysis
		const stateBefore = si.state.status
		const stabilityBefore = si.state.stability
		const difficultyBefore = si.state.difficulty

		// Grade mutates nothing; newState is a fresh object
		const newState = scheduler.grade(si.state, rating, now)
		await this.dataStore.setState(itemId, newState)
		si.state = newState

		// Log uses pre-grade values for before/after analysis
		await this.dataStore.appendReview({
			ts: now.toISOString(),
			itemId,
			rating,
			stateBefore,
			stabilityBefore,
			difficultyBefore,
		})

		// Update session stats
		this.sessionStats.reviewed++
		switch (rating) {
			case 1:
				this.sessionStats.again++
				break
			case 2:
				this.sessionStats.hard++
				break
			case 3:
				this.sessionStats.good++
				break
			case 4:
				this.sessionStats.easy++
				break
		}

		this.historyIds.push(itemId)
		this.lastNoteId = si.item.noteId
	}

	private getStrategy(): SessionStrategy {
		switch (this.config.strategy) {
			case 'Anki':
				return new AnkiStrategy()
			case 'JD1':
				return new JD1Strategy()
			default:
				return assertNever(this.config.strategy)
		}
	}

	private getInitialState(): ReviewState {
		return {
			status: 'new',
			due: null,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
		}
	}

	/**
	 * Prevents reviewing too many clozes from the same note consecutively.
	 * If the last N reviews were all from noteId X, exclude X from this pick.
	 * This only affects the immediate next selection; X becomes eligible again after.
	 */
	private applyClumpLimit(items: SessionItem[]): SessionItem[] {
		const limit = this.config.clumpLimit ?? 3
		if (this.historyIds.length < limit) return items

		const recentNoteIds = this.historyIds
			.slice(-limit)
			.map((id) => this.pool.find((p) => p.item.id === id)?.item.noteId)
			.filter(Boolean)

		const lastNoteId = recentNoteIds[recentNoteIds.length - 1]
		const isClumped =
			recentNoteIds.every((id) => id === lastNoteId) && recentNoteIds.length === limit

		if (isClumped) {
			return items.filter((si) => si.item.noteId !== lastNoteId)
		}

		return items
	}

	private filterByFolder(items: ReviewItem[], folderPath: string): ReviewItem[] {
		if (folderPath === '/') {
			// Root folder: items with no folder in path
			return items.filter((item) => !item.notePath.includes('/'))
		}
		const normalized = folderPath.replace(/\/$/, '')
		return items.filter(
			(item) => item.notePath === normalized || item.notePath.startsWith(`${normalized}/`),
		)
	}

	getCounts(now: Date): { new: number; learning: number; due: number } {
		let newCount = 0
		let learningCount = 0
		let dueCount = 0

		for (const si of this.pool) {
			if (si.state.status === 'new') {
				newCount++
			} else if (si.state.status === 'learning' || si.state.status === 'relearning') {
				learningCount++
			} else if (si.state.due && si.state.due <= now) {
				dueCount++
			}
		}

		return { new: newCount, learning: learningCount, due: dueCount }
	}

	getSessionStats(): SessionStats {
		return { ...this.sessionStats }
	}

	resetSession(): void {
		this.sessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
		this.historyIds = []
		this.volatileQueue = []
		this.lastNoteId = null
	}
}
