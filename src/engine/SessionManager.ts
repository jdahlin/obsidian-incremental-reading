import type {
	SessionItem,
	SessionConfig,
	DataStore,
	NotePlatform,
	Rating,
	ReviewState,
	ReviewItem,
	SessionStats,
} from './types';
import type { SessionStrategy, StrategyContext } from './strategies/types';
import { JD1Strategy } from './strategies/JD1Strategy';
import { AnkiStrategy } from './strategies/AnkiStrategy';
import { getScheduler, TopicScheduler } from './scheduling';

export interface LoadPoolOptions {
	folderFilter?: string;
}

export class SessionManager {
	private pool: SessionItem[] = [];
	private volatileQueue: SessionItem[] = [];
	private historyIds: string[] = [];
	private lastNoteId: string | null = null;
	private seed: number = Date.now();
	private sessionStats: SessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };

	constructor(
		private dataStore: DataStore,
		private notePlatform: NotePlatform,
		private config: SessionConfig,
	) {}

	setConfig(config: SessionConfig): void {
		this.config = config;
	}

	async loadPool(now: Date = new Date(), options?: LoadPoolOptions): Promise<void> {
		let items = await this.dataStore.listItems();

		// Apply folder filtering
		if (options?.folderFilter) {
			items = this.filterByFolder(items, options.folderFilter);
		}

		const scheduler = getScheduler(
			this.config.schedulerId ?? 'fsrs',
			this.config.schedulingParams,
		);

		let sessionItems: SessionItem[] = [];
		for (const item of items) {
			let state: ReviewState | null = await this.dataStore.getState(item.id);
			if (!state) {
				state = this.getInitialState();
			}

			// Apply exam adjustment if configured
			if (this.config.examDate && scheduler.applyExamAdjustment) {
				state = scheduler.applyExamAdjustment(state, this.config.examDate, now);
			}

			sessionItems.push({
				item,
				state,
				score: 0,
			});
		}

		// Apply new cards limit
		if (this.config.newCardsLimit != null) {
			const newItems = sessionItems.filter((si) => si.state.status === 'new');
			const limitedNew = newItems.slice(0, this.config.newCardsLimit);
			const limitedNewIds = new Set(limitedNew.map((si) => si.item.id));
			sessionItems = sessionItems.filter(
				(si) => si.state.status !== 'new' || limitedNewIds.has(si.item.id),
			);
		}

		this.pool = sessionItems;
	}

	async getNext(now: Date = new Date()): Promise<SessionItem | null> {
		const candidates = await this.getRankedCandidates(now);
		if (candidates.length === 0) return null;

		// Probabilistic interleaving for JD1 (80/20)
		if (this.config.strategy === 'JD1' && candidates.length > 1 && !this.config.deterministic) {
			const rand = Math.random();
			if (rand > 0.8) {
				// Pick from lower bands (randomly from the rest)
				const index = 1 + Math.floor(Math.random() * (candidates.length - 1));
				return candidates[index] ?? null;
			}
		}

		return candidates[0] ?? null;
	}

	async getNextN(n: number, now: Date = new Date()): Promise<SessionItem[]> {
		const candidates = await this.getRankedCandidates(now);
		return candidates.slice(0, n);
	}

	private async getRankedCandidates(now: Date): Promise<SessionItem[]> {
		if (this.pool.length === 0) return [];

		const strategy = this.getStrategy();
		const linkedNoteIds = this.lastNoteId
			? new Set(await this.notePlatform.getLinks(this.lastNoteId))
			: new Set<string>();

		const context: StrategyContext = {
			lastNoteId: this.lastNoteId,
			linkedNoteIds,
			now,
			seed: this.seed,
		};

		// Filter out items in history or currently being cooled down
		const availablePool = this.pool.filter(
			(si) =>
				!this.historyIds.includes(si.item.id) &&
				!this.volatileQueue.some((v) => v.item.id === si.item.id),
		);

		if (availablePool.length === 0 && this.volatileQueue.length === 0) return [];

		// Check volatileQueue for items that passed cooldown
		const readyFromVolatile = this.volatileQueue.filter((si) => {
			const indexInHistory = this.historyIds.lastIndexOf(si.item.id);
			if (indexInHistory === -1) return true;
			const itemsSince = this.historyIds.length - 1 - indexInHistory;
			return itemsSince >= (this.config.cooldown ?? 5);
		});

		let candidates = strategy.rank(
			[...availablePool, ...readyFromVolatile],
			this.config,
			context,
		);

		// Apply clump limit: max 3 clozes per note in a row
		candidates = this.applyClumpLimit(candidates);

		return candidates;
	}

	async recordReview(itemId: string, rating: Rating, now: Date = new Date()): Promise<void> {
		const si = this.pool.find((p) => p.item.id === itemId);
		if (!si) return;

		// Use TopicScheduler for topics, configured scheduler for clozes
		const scheduler =
			si.item.type === 'topic'
				? new TopicScheduler()
				: getScheduler(this.config.schedulerId ?? 'fsrs', this.config.schedulingParams);

		if (rating === 1) {
			// Again: move to volatile queue
			if (!this.volatileQueue.some((v) => v.item.id === itemId)) {
				this.volatileQueue.push(si);
			}
		} else {
			// Graduate: remove from volatile if present
			this.volatileQueue = this.volatileQueue.filter((v) => v.item.id !== itemId);
		}

		// Capture state before grading for the review log
		const stateBefore = si.state.status;
		const stabilityBefore = si.state.stability;
		const difficultyBefore = si.state.difficulty;

		// Always persist state (even for Again) to satisfy tests and ensure data safety
		const newState = scheduler.grade(si.state, rating, now);
		await this.dataStore.setState(itemId, newState);
		si.state = newState;

		// Append to persistent log
		await this.dataStore.appendReview({
			ts: now.toISOString(),
			itemId,
			rating,
			stateBefore,
			stabilityBefore,
			difficultyBefore,
		});

		// Update session stats
		this.sessionStats.reviewed++;
		switch (rating) {
			case 1:
				this.sessionStats.again++;
				break;
			case 2:
				this.sessionStats.hard++;
				break;
			case 3:
				this.sessionStats.good++;
				break;
			case 4:
				this.sessionStats.easy++;
				break;
		}

		this.historyIds.push(itemId);
		this.lastNoteId = si.item.noteId;
	}

	private getStrategy(): SessionStrategy {
		switch (this.config.strategy) {
			case 'Anki':
				return new AnkiStrategy();
			case 'JD1':
			default:
				return new JD1Strategy();
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
		};
	}

	private applyClumpLimit(items: SessionItem[]): SessionItem[] {
		const limit = this.config.clumpLimit ?? 3;
		if (this.historyIds.length < limit) return items;

		const recentNoteIds = this.historyIds
			.slice(-limit)
			.map((id) => this.pool.find((p) => p.item.id === id)?.item.noteId)
			.filter(Boolean);

		// If the last N items are all from the same note, we should avoid that note
		const lastNoteId = recentNoteIds[recentNoteIds.length - 1];
		const isClumped =
			recentNoteIds.every((id) => id === lastNoteId) && recentNoteIds.length === limit;

		if (isClumped) {
			// Filter out items from this note for the very next pick
			return items.filter((si) => si.item.noteId !== lastNoteId);
		}

		return items;
	}

	private filterByFolder(items: ReviewItem[], folderPath: string): ReviewItem[] {
		if (folderPath === '/') {
			// Root folder: items with no folder in path
			return items.filter((item) => !item.notePath.includes('/'));
		}
		const normalized = folderPath.replace(/\/$/, '');
		return items.filter(
			(item) => item.notePath === normalized || item.notePath.startsWith(`${normalized}/`),
		);
	}

	getCounts(now: Date): { new: number; learning: number; due: number } {
		let newCount = 0;
		let learningCount = 0;
		let dueCount = 0;

		for (const si of this.pool) {
			if (si.state.status === 'new') {
				newCount++;
			} else if (si.state.status === 'learning' || si.state.status === 'relearning') {
				learningCount++;
			} else if (si.state.due && si.state.due <= now) {
				dueCount++;
			}
		}

		return { new: newCount, learning: learningCount, due: dueCount };
	}

	getSessionStats(): SessionStats {
		return { ...this.sessionStats };
	}

	resetSession(): void {
		this.sessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		this.historyIds = [];
		this.volatileQueue = [];
		this.lastNoteId = null;
	}
}
