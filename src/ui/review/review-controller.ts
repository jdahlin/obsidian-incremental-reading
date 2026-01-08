import type { App, EventRef, TAbstractFile } from 'obsidian';
import { buildDeckTree, getCountsForFolder } from '../../core/decks';
import { buildQueue, getNextItem } from '../../core/queue';
import { mapGradeToRating, gradeItem, gradeTopic } from '../../core/scheduling';
import type {
	DeckInfo,
	ReviewItem,
	ReviewQueue,
	ReviewRecord,
	StreakInfo,
	TodayStats,
} from '../../core/types';
import { formatDate } from '../../core/frontmatter';
import { appendReview } from '../../data/revlog';
import { updateClozeState, updateTopicState } from '../../data/review-items';
import { loadReviewItems } from '../../data/review-loader';
import { getStreakInfo, getTodayStats } from '../../data/review-stats';
import { loadReviewItemHtml, type ReviewPhase } from '../../review/content';
import type { DeckCountsValue } from './deck-summary-types';
import type { ReviewScreenActions, ReviewScreenState } from './review-screen-state';
import type { SessionStats } from './review-screen-types';
import { StatsModal } from '../stats/StatsModal';

export interface ReviewSettings {
	newCardsPerDay: number;
	maximumInterval: number;
	requestRetention: number;
	extractTag: string;
	trackReviewTime: boolean;
	showStreak: boolean;
}

export interface ReviewControllerDeps {
	app: App;
	view: unknown;
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

const emptyTodayStats: TodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };

const emptyStreak: StreakInfo = { current: 0, longest: 0 };

function createSessionStats(): SessionStats {
	return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

export class ReviewController {
	private listeners = new Set<Listener>();
	private vaultEventRefs: EventRef[] = [];
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
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
		const { vault } = this.deps.app;
		this.vaultEventRefs.push(
			vault.on('create', (file) => this.onFileChange(file)),
			vault.on('delete', (file) => this.onFileChange(file)),
			vault.on('modify', (file) => this.onFileChange(file)),
		);
	}

	unmount(): void {
		this.vaultEventRefs.forEach((ref) => this.deps.app.vault.offref(ref));
		this.vaultEventRefs = [];
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	private onFileChange(file: TAbstractFile): void {
		if (file.path.startsWith('IR/Review Items/')) {
			if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
			this.refreshTimeout = setTimeout(() => {
				void this.refreshSummary();
			}, 500);
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

	handleKeyDown(event: KeyboardEvent): void {
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
			this.onShowAnswer();
			return;
		}

		if (['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault();
			void this.onGrade(Number(event.key));
		}
	}

	async refreshSummary(): Promise<void> {
		const requestId = ++this.refreshRequestId;
		const now = new Date();
		const items = await loadReviewItems(this.deps.app, this.deps.settings.extractTag);
		const decks = buildDeckTree(items, now);
		const allCounts = getCountsForFolder(items, '', now);
		const todayStats = await getTodayStats(this.deps.app, now);
		const streak = await getStreakInfo(this.deps.app, now);
		if (requestId !== this.refreshRequestId) return;

		const selectedPath = getPreselectedPath(this.deps.app, decks);
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
				await updateTopicState(this.deps.app, item.noteId, nextState, item.notePath);
			} else {
				nextState = gradeItem(item.state, rating, now, {
					maximumInterval: this.deps.settings.maximumInterval,
					requestRetention: this.deps.settings.requestRetention,
				});
				await updateClozeState(
					this.deps.app,
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
		await appendReview(this.deps.app, entry);

		const sessionStats = updateSessionStats(this.model.sessionStats, grade);
		this.setModel((prev) => ({ ...prev, sessionStats }));
		await this.advanceQueue();
	}

	private async loadItemContent(item: ReviewItem | null, phase: ReviewPhase): Promise<void> {
		const requestId = ++this.contentRequestId;
		const html = await loadReviewItemHtml(
			{ app: this.deps.app, view: this.deps.view, extractTag: this.deps.settings.extractTag },
			item,
			phase,
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

		if (this.model.phase === 'question') {
			return {
				type: 'question',
				content: this.model.currentContent,
				clozeIndex:
					this.model.currentItem.type === 'item'
						? (this.model.currentItem.clozeIndex ?? null)
						: null,
			};
		}

		return { type: 'answer', content: this.model.currentContent };
	}

	private readonly onSelectDeck = (path: string | null): void => {
		this.setModel((prev) => ({ ...prev, selectedPath: path }));
	};

	private readonly onStudy = (): void => {
		void this.startReview();
	};

	private readonly onStats = (): void => {
		new StatsModal(this.deps.app, this.deps.settings.extractTag).open();
	};

	private readonly onBack = (): void => {
		void this.backToSummary();
	};

	private readonly onShowAnswer = (): void => {
		this.showAnswer();
	};

	private readonly onGrade = (grade: number): void => {
		void this.gradeCurrentItem(grade);
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

function collectDeckPaths(decks: DeckInfo[]): Set<string> {
	const paths = new Set<string>();
	const walk = (nodes: DeckInfo[]): void => {
		for (const node of nodes) {
			paths.add(node.path);
			if (node.children.length) walk(node.children);
		}
	};
	walk(decks);
	return paths;
}

function getPreselectedPath(app: App, decks: DeckInfo[]): string | null {
	const active = app.workspace.getActiveFile();
	if (!active) return null;
	let folder = active.parent?.path ?? '';
	if (!folder) return null;
	const deckPaths = collectDeckPaths(decks);
	while (folder) {
		if (deckPaths.has(folder)) return folder;
		const parts = folder.split('/');
		parts.pop();
		folder = parts.join('/');
	}
	return null;
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
