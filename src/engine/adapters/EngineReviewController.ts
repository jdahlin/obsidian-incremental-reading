import { SessionManager } from '../SessionManager';
import type { SessionConfig, SessionItem, Rating, ReviewState } from '../types';
import type { DataStore, NotePlatform } from '../types';
import type {
	ReviewItem as CoreReviewItem,
	DeckInfo,
	TodayStats,
	StreakInfo,
	ReviewPlatformAdapter,
	ItemState,
} from '../../core/types';
import { buildDeckTree, getCountsForFolder } from '../../core/decks';
import type { ReviewPhase } from '../../review/content';
import type { DeckCountsValue } from '../../ui/review/deck-summary-types';
import type {
	DebugInfo,
	ReviewScreenActions,
	ReviewScreenState,
} from '../../ui/review/review-screen-state';
import type { SessionStats as UISessionStats } from '../../ui/review/review-screen-types';

export interface EngineReviewSettings {
	newCardsPerDay: number;
	maximumInterval: number;
	requestRetention: number;
	extractTag: string;
	trackReviewTime: boolean;
	showStreak: boolean;
	strategy: 'JD1' | 'Anki';
	clumpLimit?: number;
	cooldown?: number;
}

export interface EngineReviewControllerDeps {
	platform: ReviewPlatformAdapter;
	settings: EngineReviewSettings;
	dataStore: DataStore;
	notePlatform: NotePlatform;
}

interface EngineReviewModel {
	screen: 'folder' | 'review';
	items: CoreReviewItem[];
	decks: DeckInfo[];
	allCounts: DeckCountsValue;
	selectedPath: string | null;
	todayStats: TodayStats;
	streak: StreakInfo;
	currentSessionItem: SessionItem | null;
	phase: ReviewPhase;
	sessionStats: UISessionStats;
	currentStartedAt: Date | null;
	currentContent: string;
}

type Listener = (state: ReviewScreenState) => void;

const emptyCounts: DeckCountsValue = { new: 0, learning: 0, due: 0 };
const emptyTodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
const emptyStreak = { current: 0, longest: 0 };

function createSessionStats(): UISessionStats {
	return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

/**
 * Engine-powered review controller using SessionManager for advanced queue logic.
 * Provides JD1 strategy, volatile queue, clump limiting, and linked note affinity.
 */
export class EngineReviewController {
	private listeners = new Set<Listener>();
	private unbindDataChange: (() => void) | null = null;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	private sessionManager: SessionManager | null = null;
	private static readonly SPACE_GRADE: 1 | 2 | 3 | 4 = 3;
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
	};
	private state: ReviewScreenState = this.buildScreenState();
	private refreshRequestId = 0;
	private contentRequestId = 0;

	constructor(private deps: EngineReviewControllerDeps) {}

	mount(): void {
		this.unbindDataChange = this.deps.platform.onDataChange(() => {
			if (this.model.screen === 'review') return;
			if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
			this.refreshTimeout = setTimeout(() => {
				void this.refreshSummary();
			}, 500);
		});
	}

	unmount(): void {
		if (this.unbindDataChange) {
			this.unbindDataChange();
			this.unbindDataChange = null;
		}
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getState(): ReviewScreenState {
		return this.state;
	}

	getModel(): Readonly<EngineReviewModel> {
		return this.model;
	}

	getActions(): ReviewScreenActions {
		return {
			onSelectDeck: this.onSelectDeck,
			onStudy: this.onStudy,
			onStats: this.onStats,
			onBack: this.onBack,
			onShowAnswer: this.onShowAnswer,
			onGrade: this.onGrade,
		};
	}

	handleKeyDown(event: KeyboardEvent): void | Promise<void> {
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

		if (event.key === 'Escape' && this.model.screen === 'review') {
			void this.onBack();
			return;
		}
		if (this.model.screen !== 'review') return;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (this.model.phase === 'question') {
				this.onShowAnswer();
			} else {
				return this.onGrade(EngineReviewController.SPACE_GRADE);
			}
			return;
		}

		if (['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault();
			return this.onGrade(Number(event.key));
		}
	}

	async refreshSummary(): Promise<void> {
		const requestId = ++this.refreshRequestId;
		const now = new Date();

		// Use dataStore directly to get all items (no tag filtering)
		const engineItems = await this.deps.dataStore.listItems();
		const items: CoreReviewItem[] = [];
		for (const engineItem of engineItems) {
			const state = await this.deps.dataStore.getState(engineItem.id);
			items.push({
				id: engineItem.id,
				noteId: engineItem.noteId,
				notePath: engineItem.notePath,
				type: engineItem.type === 'topic' ? 'topic' : 'item',
				clozeIndex: engineItem.clozeIndex,
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
			});
		}

		const decks = buildDeckTree(items, now);
		const allCounts = getCountsForFolder(items, '', now);
		const todayStats = await this.deps.platform.getTodayStats(now);
		const streak = await this.deps.platform.getStreakInfo(now);
		if (requestId !== this.refreshRequestId) return;

		const selectedPath = this.deps.platform.getPreselectedPath(decks);
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
		}));
	}

	async startReview(): Promise<void> {
		const now = new Date();

		// Build session config from settings
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
		};

		// Create SessionManager
		this.sessionManager = new SessionManager(
			this.deps.dataStore,
			this.deps.notePlatform,
			config,
		);

		// Load pool with folder filter
		await this.sessionManager.loadPool(now, {
			folderFilter: this.model.selectedPath ?? undefined,
		});

		// Get first item
		const currentSessionItem = await this.sessionManager.getNext(now);
		const phase = this.determinePhase(currentSessionItem);

		this.setModel((prev) => ({
			...prev,
			screen: 'review',
			currentSessionItem,
			phase,
			sessionStats: createSessionStats(),
			currentStartedAt: currentSessionItem ? now : null,
			currentContent: '',
		}));

		await this.loadItemContent(currentSessionItem, phase);
	}

	async gradeCurrentItem(grade: number): Promise<void> {
		const si = this.model.currentSessionItem;
		if (!si || !this.sessionManager) return;

		if (si.item.type === 'cloze' && this.model.phase === 'question') {
			this.showAnswer();
			return;
		}

		const now = new Date();
		const rating = grade as Rating;

		// Record review through session manager (persists to sidecar files)
		await this.sessionManager.recordReview(si.item.id, rating, now);

		// Update session stats
		const engineStats = this.sessionManager.getSessionStats();
		const sessionStats: UISessionStats = {
			reviewed: engineStats.reviewed,
			again: engineStats.again,
			hard: engineStats.hard,
			good: engineStats.good,
			easy: engineStats.easy,
		};
		this.setModel((prev) => ({ ...prev, sessionStats }));

		await this.advanceQueue();
	}

	private determinePhase(si: SessionItem | null): ReviewPhase {
		if (!si) return 'question';
		return si.item.type === 'cloze' && si.item.clozeIndex != null ? 'question' : 'answer';
	}

	private async loadItemContent(si: SessionItem | null, phase: ReviewPhase): Promise<void> {
		const requestId = ++this.contentRequestId;
		if (!si) {
			this.setModel((prev) => ({ ...prev, currentContent: '' }));
			return;
		}

		// Convert SessionItem to CoreReviewItem for platform adapter
		const coreItem = this.sessionItemToCoreItem(si);
		const html = await this.deps.platform.renderItem(
			coreItem,
			phase,
			this.deps.settings.extractTag,
		);
		if (requestId !== this.contentRequestId) return;
		this.setModel((prev) => ({ ...prev, currentContent: html }));
	}

	private async backToSummary(): Promise<void> {
		this.sessionManager = null;
		await this.refreshSummary();
	}

	private showAnswer(): void {
		const si = this.model.currentSessionItem;
		if (si?.item.type === 'cloze' && this.model.phase === 'question') {
			this.setModel((prev) => ({ ...prev, phase: 'answer' }));
			void this.loadItemContent(si, 'answer');
		}
	}

	private async advanceQueue(): Promise<void> {
		if (!this.sessionManager) return;

		const now = new Date();
		const nextItem = await this.sessionManager.getNext(now);
		const phase = this.determinePhase(nextItem);

		this.setModel((prev) => ({
			...prev,
			currentSessionItem: nextItem,
			phase,
			currentStartedAt: nextItem ? new Date() : null,
			currentContent: '',
		}));

		await this.loadItemContent(nextItem, phase);
	}

	private emit(): void {
		this.state = this.buildScreenState();
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	private setModel(
		update: EngineReviewModel | ((prev: EngineReviewModel) => EngineReviewModel),
	): void {
		this.model = typeof update === 'function' ? update(this.model) : update;
		this.emit();
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
			};
		}

		if (!this.model.currentSessionItem) {
			return { type: 'finished', sessionStats: this.model.sessionStats };
		}

		const si = this.model.currentSessionItem;
		const debugInfo: DebugInfo = {
			queue: this.getQueueName(si.state.status),
			status: si.state.status,
			priority: si.item.priority,
			due: si.state.due?.toISOString() ?? null,
			stability: si.state.stability,
			difficulty: si.state.difficulty,
			reps: si.state.reps,
			lapses: si.state.lapses,
		};

		if (this.model.phase === 'question') {
			return {
				type: 'question',
				content: this.model.currentContent,
				clozeIndex: si.item.type === 'cloze' ? (si.item.clozeIndex ?? null) : null,
				debugInfo,
			};
		}

		return { type: 'answer', content: this.model.currentContent, debugInfo };
	}

	private getQueueName(status: string): string {
		if (status === 'new') return 'new';
		if (status === 'learning' || status === 'relearning') return 'learning';
		return 'review';
	}

	private sessionItemToCoreItem(si: SessionItem): CoreReviewItem {
		return {
			id: si.item.id,
			noteId: si.item.noteId,
			notePath: si.item.notePath,
			type: si.item.type === 'topic' ? 'topic' : 'item',
			clozeIndex: si.item.clozeIndex,
			state: this.reviewStateToItemState(si.state),
			priority: si.item.priority,
			created: si.item.created,
		};
	}

	private reviewStateToItemState(state: ReviewState): ItemState {
		return {
			status: state.status,
			due: state.due,
			stability: state.stability,
			difficulty: state.difficulty,
			reps: state.reps,
			lapses: state.lapses,
			last_review: state.lastReview,
		};
	}

	private readonly onSelectDeck = (path: string | null): void => {
		this.setModel((prev) => ({ ...prev, selectedPath: path }));
	};

	private readonly onStudy = (): void => {
		void this.startReview();
	};

	private readonly onStats = (): void => {
		this.deps.platform.openStats(this.deps.settings.extractTag);
	};

	private readonly onBack = (): void => {
		void this.backToSummary();
	};

	private readonly onShowAnswer = (): void => {
		this.showAnswer();
	};

	private readonly onGrade = async (grade: number): Promise<void> => {
		await this.gradeCurrentItem(grade);
	};
}
