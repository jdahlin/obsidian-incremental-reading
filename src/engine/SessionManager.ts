import type {
	SessionItem,
	SessionConfig,
	DataStore,
	NotePlatform,
	Rating,
	ReviewState,
} from './types';
import type { SessionStrategy, StrategyContext } from './strategies/types';
import { JD1Strategy } from './strategies/JD1Strategy';
import { AnkiStrategy } from './strategies/AnkiStrategy';
import { getScheduler } from './scheduling';

export class SessionManager {
	private pool: SessionItem[] = [];
	private volatileQueue: SessionItem[] = [];
	private historyIds: string[] = [];
	private lastNoteId: string | null = null;
	private seed: number = Date.now();

	constructor(
		private dataStore: DataStore,
		private notePlatform: NotePlatform,
		private config: SessionConfig,
	) {}

	setConfig(config: SessionConfig): void {
		this.config = config;
	}

	async loadPool(now: Date = new Date()): Promise<void> {
		const items = await this.dataStore.listItems();
		const scheduler = getScheduler(this.config.schedulerId ?? 'fsrs');

		const sessionItems: SessionItem[] = [];
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

		this.pool = sessionItems;
	}

	async getNext(now: Date = new Date()): Promise<SessionItem | null> {
		if (this.pool.length === 0) return null;

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

		// Filter out items in history or currently being cooled down?
		// Actually, volatileQueue items shouldn't be in the pool selection until cooldown passes.
		const availablePool = this.pool.filter(
			(si) =>
				!this.historyIds.includes(si.item.id) &&
				!this.volatileQueue.some((v) => v.item.id === si.item.id),
		);

		if (availablePool.length === 0 && this.volatileQueue.length === 0) return null;

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

	async recordReview(itemId: string, rating: Rating, now: Date = new Date()): Promise<void> {
		const si = this.pool.find((p) => p.item.id === itemId);
		if (!si) return;

		const scheduler = getScheduler(this.config.schedulerId ?? 'fsrs');

		if (rating === 1) {
			// Again: move to volatile queue
			if (!this.volatileQueue.some((v) => v.item.id === itemId)) {
				this.volatileQueue.push(si);
			}
			await this.dataStore.appendReview({
				ts: now.toISOString(),
				itemId,
				rating,
				stateBefore: si.state.status,
				stabilityBefore: si.state.stability,
				difficultyBefore: si.state.difficulty,
			});
		} else {
			// Graduate: remove from volatile if present
			this.volatileQueue = this.volatileQueue.filter((v) => v.item.id !== itemId);
		}

		// Always persist state (even for Again) to satisfy tests and ensure data safety
		const newState = scheduler.grade(si.state, rating, now);
		await this.dataStore.setState(itemId, newState);
		si.state = newState;

		// Append to persistent log
		await this.dataStore.appendReview({
			ts: now.toISOString(),
			itemId,
			rating,
			stateBefore: si.state.status,
			stabilityBefore: si.state.stability,
			difficultyBefore: si.state.difficulty,
		});

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
}
