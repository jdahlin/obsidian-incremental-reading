import type {
	ReviewItem as CoreReviewItem,
	DeckInfo,
	ItemState,
	ReviewPlatformAdapter,
	StreakInfo,
	TodayStats,
} from '@repo/core/core/types';
import type {
	DataStore,
	NotePlatform,
	Rating,
	ReviewState,
	SessionConfig,
	SessionItem,
} from '@repo/core/types';
import type { SessionStateData } from '../data/session';
import type { ReviewPhase } from '../review/content';
import type { DeckCountsValue } from '../review/deck-summary-types';
import type {
	DebugInfo,
	ReviewScreenActions,
	ReviewScreenState,
} from '../review/review-screen-state';
import type { SessionStats as UISessionStats } from '../review/review-screen-types';
import { formatReviewContent } from '@repo/core/core/content';
import { buildDeckTree, getCountsForFolder } from '@repo/core/core/decks';
import { SessionManager } from '@repo/core/SessionManager';
import { buildSessionState } from '../data/session';

/** Extended platform adapter with optional session state support */
interface ExtendedPlatformAdapter extends ReviewPlatformAdapter {
	updateSessionState?: (data: SessionStateData) => Promise<void>;
}

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
	platform: ExtendedPlatformAdapter;
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
				type: this.mapItemType(engineItem.type),
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
		await this.updateSessionFile();
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
		// Cloze and basic cards start with question phase
		// Topic cards go directly to answer (show full content)
		const type = si.item.type;
		if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
			return 'question';
		}
		return 'answer';
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
		if (!si || this.model.phase !== 'question') return;

		const type = si.item.type;
		if (type === 'cloze' || type === 'basic' || type === 'image_occlusion') {
			this.setModel((prev) => ({ ...prev, phase: 'answer' }));
			void this.loadItemContent(si, 'answer').then(async () => this.updateSessionFile());
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
		await this.updateSessionFile();
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
			type: this.mapItemType(si.item.type),
			clozeIndex: si.item.clozeIndex,
			state: this.reviewStateToItemState(si.state),
			priority: si.item.priority,
			created: si.item.created,
		};
	}

	/** Map ItemType to CardType, preserving basic and image_occlusion */
	private mapItemType(type: string): CoreReviewItem['type'] {
		const typeMap: Record<string, CoreReviewItem['type']> = {
			topic: 'topic',
			cloze: 'item',
			basic: 'basic',
			image_occlusion: 'image_occlusion',
		};
		return typeMap[type] ?? 'item';
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

	private async updateSessionFile(): Promise<void> {
		if (!this.deps.platform.updateSessionState) return;

		const now = new Date();
		const queueCounts = this.sessionManager
			? await this.getQueueCounts(now)
			: { new: 0, learning: 0, due: 0, total: 0 };

		// Get raw and formatted markdown for debugging
		let rawMarkdown: string | null = null;
		let formattedMarkdown: string | null = null;

		const si = this.model.currentSessionItem;
		if (si) {
			rawMarkdown = await this.deps.notePlatform.getNote(si.item.noteId);
			if (rawMarkdown !== null) {
				formattedMarkdown = formatReviewContent(
					rawMarkdown,
					si.item.type,
					this.model.phase,
					si.item.clozeIndex,
				);
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
		});

		await this.deps.platform.updateSessionState(data);
	}

	private async getQueueCounts(
		now: Date,
	): Promise<{ new: number; learning: number; due: number; total: number }> {
		if (!this.sessionManager) {
			return { new: 0, learning: 0, due: 0, total: 0 };
		}

		const items = await this.sessionManager.getNextN(10000);
		let newCount = 0;
		let learningCount = 0;
		let dueCount = 0;

		for (const item of items) {
			if (item.state.status === 'new') {
				newCount++;
			} else if (item.state.status === 'learning' || item.state.status === 'relearning') {
				learningCount++;
			} else if (item.state.due && item.state.due <= now) {
				dueCount++;
			}
		}

		return {
			new: newCount,
			learning: learningCount,
			due: dueCount,
			total: items.length,
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
