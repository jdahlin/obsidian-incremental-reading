import { buildDeckTree, getCountsForFolder } from '../../core/decks';
import { buildQueue, getNextItem } from '../../core/queue';
import { mapGradeToRating, gradeItem, gradeTopic } from '../../core/scheduling';
import type {
	ReviewItem,
	ReviewQueue,
	ReviewRecord,
	ReviewPlatformAdapter,
	DeckInfo,
	TodayStats,
	StreakInfo,
} from '../../core/types';
import { formatDate } from '../../core/frontmatter';
import type { ReviewPhase } from '../../review/content';
import type { DeckCountsValue } from './deck-summary-types';
import type { DebugInfo, ReviewScreenActions, ReviewScreenState } from './review-screen-state';
import type { SessionStats } from './review-screen-types';

export interface ReviewSettings {
	newCardsPerDay: number;
	maximumInterval: number;
	requestRetention: number;
	extractTag: string;
	trackReviewTime: boolean;
	showStreak: boolean;
}

export interface ReviewControllerDeps {
	platform: ReviewPlatformAdapter;
	settings: ReviewSettings;
}

interface ReviewModel {
	screen: 'folder' | 'review';
	items: ReviewItem[];
	decks: DeckInfo[];
	allCounts: DeckCountsValue;
	selectedPath: string | null;
	todayStats: TodayStats;
	streak: StreakInfo;
	queue: ReviewQueue | null;
	currentItem: ReviewItem | null;
	phase: ReviewPhase;
	sessionStats: SessionStats;
	currentStartedAt: Date | null;
	currentContent: string;
}

type Listener = (state: ReviewScreenState) => void;

const emptyCounts: DeckCountsValue = { new: 0, learning: 0, due: 0 };

const emptyTodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };

const emptyStreak = { current: 0, longest: 0 };

function createSessionStats(): SessionStats {
	return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

export class ReviewController {
	private listeners = new Set<Listener>();
	private unbindDataChange: (() => void) | null = null;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	private static readonly SPACE_GRADE: 1 | 2 | 3 | 4 = 3;
	private model: ReviewModel = {
		screen: 'folder',
		items: [],
		decks: [],
		allCounts: emptyCounts,
		selectedPath: null,
		todayStats: emptyTodayStats,
		streak: emptyStreak,
		queue: null,
		currentItem: null,
		phase: 'question',
		sessionStats: createSessionStats(),
		currentStartedAt: null,
		currentContent: '',
	};
	private state: ReviewScreenState = this.buildScreenState();
	private refreshRequestId = 0;
	private contentRequestId = 0;

	constructor(private deps: ReviewControllerDeps) {}

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

	getModel(): Readonly<ReviewModel> {
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
				return this.onGrade(ReviewController.SPACE_GRADE);
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
		const items = await this.deps.platform.loadItems(this.deps.settings.extractTag);
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
			queue: null,
			currentItem: null,
			phase: 'question',
			sessionStats: createSessionStats(),
			currentStartedAt: null,
			currentContent: '',
		}));
	}

	async startReview(): Promise<void> {
		const now = new Date();
		const queue = buildQueue(this.model.items, now, {
			newCardsLimit: this.deps.settings.newCardsPerDay,
			folderFilter: this.model.selectedPath ?? undefined,
		});
		const currentItem = getNextItem(queue);
		const phase =
			currentItem?.type === 'item' && currentItem.clozeIndex != null ? 'question' : 'answer';

		this.setModel((prev) => ({
			...prev,
			screen: 'review',
			queue,
			currentItem,
			phase,
			sessionStats: createSessionStats(),
			currentStartedAt: currentItem ? now : null,
			currentContent: '',
		}));
		await this.loadItemContent(currentItem, phase);
	}

	async gradeCurrentItem(grade: number): Promise<void> {
		const item = this.model.currentItem;
		if (!item) return;
		if (item.type === 'item' && this.model.phase === 'question') {
			this.showAnswer();
			return;
		}

		const now = new Date();
		const rating = mapGradeToRating(grade);
		const previous = { ...item.state };
		let nextState = previous;

		try {
			if (item.type === 'topic') {
				nextState = gradeTopic(item.state, grade, now);
				await this.deps.platform.updateTopicState(item.noteId, nextState, item.notePath);
			} else {
				nextState = gradeItem(item.state, rating, now, {
					maximumInterval: this.deps.settings.maximumInterval,
					requestRetention: this.deps.settings.requestRetention,
				});
				await this.deps.platform.updateClozeState(
					item.noteId,
					item.clozeIndex ?? 1,
					nextState,
					item.notePath,
				);
			}
		} catch (error) {
			console.error('IR: failed to update item state', error);
		}

		item.state = nextState;
		const elapsed =
			this.deps.settings.trackReviewTime && this.model.currentStartedAt
				? now.getTime() - this.model.currentStartedAt.getTime()
				: undefined;
		const entry: ReviewRecord = {
			ts: formatDate(now),
			item_id: item.id,
			rating,
			elapsed_ms: elapsed,
			state_before: previous.status,
			stability_before: previous.stability,
			difficulty_before: previous.difficulty,
		};
		await this.deps.platform.appendReview(entry);

		const sessionStats = updateSessionStats(this.model.sessionStats, grade);
		this.setModel((prev) => ({ ...prev, sessionStats }));
		await this.advanceQueue();
	}

	private async loadItemContent(item: ReviewItem | null, phase: ReviewPhase): Promise<void> {
		const requestId = ++this.contentRequestId;
		if (!item) {
			this.setModel((prev) => ({ ...prev, currentContent: '' }));
			return;
		}
		const html = await this.deps.platform.renderItem(
			item,
			phase,
			this.deps.settings.extractTag,
		);
		if (requestId !== this.contentRequestId) return;
		this.setModel((prev) => ({ ...prev, currentContent: html }));
	}

	private async backToSummary(): Promise<void> {
		await this.refreshSummary();
	}

	private showAnswer(): void {
		const item = this.model.currentItem;
		if (item?.type === 'item' && this.model.phase === 'question') {
			this.setModel((prev) => ({ ...prev, phase: 'answer' }));
			void this.loadItemContent(item, 'answer');
		}
	}

	private async advanceQueue(): Promise<void> {
		if (!this.model.queue) return;
		if (this.model.currentItem) {
			removeCurrentFromQueue(this.model.queue, this.model.currentItem);
		}
		const nextItem = getNextItem(this.model.queue);
		const phase =
			nextItem?.type === 'item' && nextItem.clozeIndex != null ? 'question' : 'answer';
		this.setModel((prev) => ({
			...prev,
			currentItem: nextItem,
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

	private setModel(update: ReviewModel | ((prev: ReviewModel) => ReviewModel)): void {
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

		if (!this.model.currentItem) {
			return { type: 'finished', sessionStats: this.model.sessionStats };
		}

		const item = this.model.currentItem;
		const debugInfo: DebugInfo = {
			queue: getQueueName(item.state.status),
			status: item.state.status,
			priority: item.priority,
			due: item.state.due?.toISOString() ?? null,
			stability: item.state.stability,
			difficulty: item.state.difficulty,
			reps: item.state.reps,
			lapses: item.state.lapses,
		};

		if (this.model.phase === 'question') {
			return {
				type: 'question',
				content: this.model.currentContent,
				clozeIndex:
					this.model.currentItem.type === 'item'
						? (this.model.currentItem.clozeIndex ?? null)
						: null,
				debugInfo,
			};
		}

		return { type: 'answer', content: this.model.currentContent, debugInfo };
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

function updateSessionStats(sessionStats: SessionStats, grade: number): SessionStats {
	const next = { ...sessionStats, reviewed: sessionStats.reviewed + 1 };
	switch (grade) {
		case 1:
			next.again += 1;
			break;
		case 2:
			next.hard += 1;
			break;
		case 3:
			next.good += 1;
			break;
		case 4:
			next.easy += 1;
			break;
		default:
			break;
	}
	return next;
}

function removeCurrentFromQueue(queue: ReviewQueue, current: ReviewItem): void {
	const remove = (list: ReviewItem[]): void => {
		const index = list.findIndex((item) => item.id === current.id);
		if (index !== -1) list.splice(index, 1);
	};
	remove(queue.learning);
	remove(queue.due);
	remove(queue.new);
}

function getQueueName(status: string): string {
	if (status === 'new') return 'new';
	if (status === 'learning' || status === 'relearning') return 'learning';
	return 'review';
}
