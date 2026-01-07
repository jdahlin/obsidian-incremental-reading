import { render } from 'preact';
import { App, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import type IncrementalReadingPlugin from '../../main';
import { DeckSummary } from './DeckSummary';
import { ReviewScreen, type SessionStats } from './ReviewScreen';
import { buildDeckTree, getCountsForFolder } from '../../core/decks';
import { buildQueue, getNextItem, getQueueStats } from '../../core/queue';
import { mapGradeToRating, gradeItem, gradeTopic } from '../../core/scheduling';
import type { DeckInfo, ReviewItem, ReviewQueue, ReviewRecord, StreakInfo, TodayStats } from '../../core/types';
import { formatDate } from '../../core/frontmatter';
import { parseClozeIndices } from '../../core/cloze';
import { appendReview } from '../../data/revlog';
import { updateClozeState, updateTopicState } from '../../data/review-items';
import { loadReviewItems } from '../../data/review-loader';
import { getStreakInfo, getTodayStats } from '../../data/review-stats';
import { syncNoteToSidecar } from '../../data/sync';
import { setActiveCloze } from '../../editor/cloze-hider';
import { StatsModal } from '../stats/StatsModal';

export const VIEW_TYPE_REVIEW = 'ir-review';

type Screen = 'summary' | 'review';

type Phase = 'question' | 'answer';

export class ReviewItemView extends ItemView {
	private screen: Screen = 'summary';
	private items: ReviewItem[] = [];
	private decks: DeckInfo[] = [];
	private selectedPath: string | null = null;
	private todayStats: TodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
	private streak: StreakInfo = { current: 0, longest: 0 };
	private queue: ReviewQueue | null = null;
	private currentItem: ReviewItem | null = null;
	private phase: Phase = 'question';
	private sessionStats: SessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
	private currentStartedAt: Date | null = null;
	private editorLeaf: WorkspaceLeaf | null = null;
	private mounted = false;
	private onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);

	constructor(leaf: WorkspaceLeaf, private appRef: App, private pluginRef: IncrementalReadingPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return 'Incremental reading';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('ir-review-view');
		this.contentEl.tabIndex = 0;
		this.contentEl.addEventListener('keydown', this.onKeyDownBound);
		await this.refreshSummary();
		this.renderView();
		this.contentEl.focus();
	}

	async onClose(): Promise<void> {
		this.contentEl.removeEventListener('keydown', this.onKeyDownBound);
		this.editorLeaf = null;
		if (this.mounted) {
			render(null, this.contentEl);
			this.mounted = false;
		}
		this.contentEl.empty();
	}

	private async refreshSummary(): Promise<void> {
		const now = new Date();
		this.items = await loadReviewItems(this.appRef, this.pluginRef.settings.extractTag);
		this.decks = buildDeckTree(this.items, now);
		this.todayStats = await getTodayStats(this.appRef, now);
		this.streak = await getStreakInfo(this.appRef, now);
		this.currentItem = null;
		this.queue = null;
		this.phase = 'question';
		this.currentStartedAt = null;
		this.updateClozeDisplay();
		this.selectedPath = this.getPreselectedPath();
		this.screen = 'summary';
	}

	private getPreselectedPath(): string | null {
		const active = this.appRef.workspace.getActiveFile();
		if (!active) return null;
		let folder = active.parent?.path ?? '';
		if (!folder) return null;
		const deckPaths = collectDeckPaths(this.decks);
		while (folder) {
			if (deckPaths.has(folder)) return folder;
			const parts = folder.split('/');
			parts.pop();
			folder = parts.join('/');
		}
		return null;
	}

	private renderView(): void {
		const allCounts = getCountsForFolder(this.items, '', new Date());
		if (this.screen === 'summary') {
			render(
				<DeckSummary
					decks={this.decks}
					selectedPath={this.selectedPath}
					allCounts={allCounts}
					todayStats={this.todayStats}
					streak={this.streak}
					showStreak={this.pluginRef.settings.showStreak}
					onSelect={(path) => {
						this.selectedPath = path;
						this.renderView();
					}}
					onStudy={() => { void this.startReview(); }}
					onStats={() => { new StatsModal(this.appRef, this.pluginRef.settings.extractTag).open(); }}
				/>,
				this.contentEl,
			);
		} else {
			const queueStats = this.queue ? getQueueStats(this.queue) : { learning: 0, due: 0, new: 0, total: 0 };
			render(
				<ReviewScreen
					selectedDeck={this.selectedPath}
					currentItem={this.currentItem}
					phase={this.phase}
					queueStats={queueStats}
					sessionStats={this.sessionStats}
					onBack={() => { void this.backToSummary(); }}
					onShowAnswer={() => this.showAnswer()}
					onGrade={(grade) => { void this.onGrade(grade); }}
				/>,
				this.contentEl,
			);
		}
		this.mounted = true;
	}

	private async startReview(): Promise<void> {
		const now = new Date();
		this.queue = buildQueue(this.items, now, {
			newCardsLimit: this.pluginRef.settings.newCardsPerDay,
			folderFilter: this.selectedPath ?? undefined,
		});
		this.currentItem = this.queue ? getNextItem(this.queue) : null;
		this.phase = this.currentItem?.type === 'item' ? 'question' : 'answer';
		this.sessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
		this.currentStartedAt = this.currentItem ? new Date() : null;
		this.screen = 'review';
		if (this.currentItem) {
			await this.openItemInLeaf(this.currentItem);
		}
		this.updateClozeDisplay();
		this.renderView();
	}

	private async backToSummary(): Promise<void> {
		await this.refreshSummary();
		this.renderView();
	}

	private showAnswer(): void {
		if (this.currentItem?.type === 'item' && this.phase === 'question') {
			this.phase = 'answer';
			this.updateClozeDisplay();
			this.renderView();
		}
	}
	private updateClozeDisplay(): void {
		if (this.currentItem?.type === 'item' && this.currentItem.clozeIndex) {
			setActiveCloze(this.appRef, this.currentItem.clozeIndex, this.phase);
			return;
		}
		setActiveCloze(this.appRef, null, 'answer');
	}


	private async onGrade(grade: number): Promise<void> {
		const item = this.currentItem;
		if (!item) return;
		if (item.type === 'item' && this.phase === 'question') {
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
				await updateTopicState(this.appRef, item.noteId, nextState, item.notePath);
			} else {
				nextState = gradeItem(item.state, rating, now, {
					maximumInterval: this.pluginRef.settings.maximumInterval,
					requestRetention: this.pluginRef.settings.requestRetention,
				});
				await updateClozeState(this.appRef, item.noteId, item.clozeIndex ?? 1, nextState, item.notePath);
			}
		} catch (error) {
			console.error('IR: failed to update item state', error);
		}

		item.state = nextState;
		const elapsed = this.pluginRef.settings.trackReviewTime && this.currentStartedAt
			? now.getTime() - this.currentStartedAt.getTime()
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
		await appendReview(this.appRef, entry);

		this.sessionStats.reviewed += 1;
		switch (grade) {
			case 1:
				this.sessionStats.again += 1;
				break;
			case 2:
				this.sessionStats.hard += 1;
				break;
			case 3:
				this.sessionStats.good += 1;
				break;
			case 4:
				this.sessionStats.easy += 1;
				break;
			default:
				break;
		}
		await this.advanceQueue();
	}

	private async advanceQueue(): Promise<void> {
		if (!this.queue) return;
		if (this.currentItem) {
			removeCurrentFromQueue(this.queue, this.currentItem);
		}
		this.currentItem = getNextItem(this.queue);
		this.phase = this.currentItem?.type === 'item' ? 'question' : 'answer';
		this.currentStartedAt = this.currentItem ? new Date() : null;
		if (this.currentItem) {
			await this.openItemInLeaf(this.currentItem);
		}
		this.updateClozeDisplay();
		this.renderView();
	}

	private async openItemInLeaf(item: ReviewItem): Promise<void> {
		const file = item.noteFile ?? this.appRef.vault.getAbstractFileByPath(item.notePath);
		if (!(file instanceof TFile)) return;
		if (item.type === 'item' && item.clozeIndex) {
			const content = await this.appRef.vault.read(file);
			const indices = parseClozeIndices(content);
			if (!indices.includes(item.clozeIndex)) {
				await syncNoteToSidecar(this.appRef, file, this.pluginRef.settings.extractTag);
			}
		}
		const leaf = this.getEditorLeaf();
		if (!leaf || leaf === this.leaf) return;
		await leaf.openFile(file, { active: true });
	}

	private getEditorLeaf(): WorkspaceLeaf | null {
		if (this.editorLeaf && this.editorLeaf !== this.leaf) return this.editorLeaf;
		const markdownLeaves = this.appRef.workspace.getLeavesOfType('markdown');
		const existing = markdownLeaves.find((leaf) => leaf !== this.leaf);
		if (existing) {
			this.editorLeaf = existing;
			return existing;
		}
		const candidates = [
			this.appRef.workspace.getLeaf('split', 'vertical'),
			this.appRef.workspace.getLeaf('tab'),
			this.appRef.workspace.getLeaf(true),
		];
		const leaf = candidates.find((candidate) => candidate && candidate !== this.leaf) ?? null;
		this.editorLeaf = leaf;
		return leaf;
	}

	private onKeyDown(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

		if (event.key === 'Escape' && this.screen === 'review') {
			void this.backToSummary();
			return;
		}
		if (this.screen !== 'review') return;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.showAnswer();
			return;
		}

		if (['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault();
			void this.onGrade(Number(event.key));
		}
	}
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

function removeCurrentFromQueue(queue: ReviewQueue, current: ReviewItem): void {
	const remove = (list: ReviewItem[]): void => {
		const index = list.findIndex((item) => item.id === current.id);
		if (index !== -1) list.splice(index, 1);
	};
	remove(queue.learning);
	remove(queue.due);
	remove(queue.new);
}
