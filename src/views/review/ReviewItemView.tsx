import { render } from 'preact';
import { App, ItemView, Scope, WorkspaceLeaf, TFile } from 'obsidian';
import { ReviewView } from './ReviewView';
import { buildQueue, getNextCard, getQueueStats, type QueueEntry, type QueueStats, type ReviewQueue } from '../../scheduling/queue';
import { createScheduler, gradeCard, writeCardState, type CardState, type Status } from '../../scheduling';
import { Rating } from 'ts-fsrs';
import type IncrementalReadingPlugin from '../../main';

export const VIEW_TYPE_REVIEW = 'my-review';

type Phase = 'question' | 'answer';

export class ReviewItemView extends ItemView {
	private phase: Phase = 'question';
	private currentGrade: number | null = null;

	private queue: ReviewQueue | null = null;
	private current: QueueEntry | null = null;
	private scheduler = createScheduler();
	private queueStats: QueueStats = { learning: 0, due: 0, new: 0, total: 0 };
	private sessionStats: SessionStats = {
		started: new Date(),
		reviewed: 0,
		again: 0,
		hard: 0,
		good: 0,
		easy: 0,
	};

	private mounted = false;
	private hotkeyScope: Scope;
	private scopePushed = false;
	private onPointerDownBound = (evt: MouseEvent) => this.onPointerDown(evt);
	private onKeyDownBound = (evt: KeyboardEvent) => this.onKeyDownFallback(evt);

	constructor(leaf: WorkspaceLeaf, private appRef: App, private pluginRef: IncrementalReadingPlugin) {
		super(leaf);

		// View-specific hotkeys via a scoped key handler.
		this.hotkeyScope = new Scope(this.app.scope);
		this.scope = this.hotkeyScope;
		this.scheduler = createScheduler({
			maximumInterval: this.pluginRef.settings.maximumInterval,
			requestRetention: this.pluginRef.settings.requestRetention,
			weights: this.pluginRef.settings.fsrsParameters,
		});

		for (let n = 1; n <= 4; n++) {
			this.hotkeyScope.register([], String(n), () => {
				this.onGrade(n);
				return true;
			});
			this.hotkeyScope.register([], `Numpad${n}`, () => {
				this.onGrade(n);
				return true;
	});
}

		this.hotkeyScope.register([], 'Enter', () => {
			this.onEnter();
			return true;
		});
		this.hotkeyScope.register([], 'NumpadEnter', () => {
			this.onEnter();
			return true;
		});

		// Space behaves like Enter: reveal answer on question, advance on answer.
		this.hotkeyScope.register([], 'Space', (evt) => {
			if (this.shouldIgnoreHotkeyEvent(evt)) return false;
			this.onEnter();
			return true;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return 'Review';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();

		// Make the view focusable so scoped hotkeys fire.
		this.contentEl.tabIndex = 0;
		// Focus the view when clicking anywhere inside it (capture = before inner elements steal focus).
		this.contentEl.addEventListener('mousedown', this.onPointerDownBound, true);
		// Fallback key handler in case Obsidian's scope routing doesn't hit our handlers.
		this.contentEl.addEventListener('keydown', this.onKeyDownBound);

		await this.refreshQueue();

		// Mount view UI.
		this.renderReact();

		this.contentEl.focus();
		this.pushHotkeyScope();
	}

	async onClose(): Promise<void> {
		this.popHotkeyScope();
		this.contentEl.removeEventListener('mousedown', this.onPointerDownBound, true);
		this.contentEl.removeEventListener('keydown', this.onKeyDownBound);
		if (this.mounted) {
			render(null, this.contentEl);
			this.mounted = false;
		}
		this.contentEl.empty();
	}

	private pushHotkeyScope(): void {
		if (this.scopePushed) return;
		// Attach our scope so Obsidian routes key events here while this view is focused.
		this.app.keymap.pushScope(this.hotkeyScope);
		this.scopePushed = true;
	}

	private popHotkeyScope(): void {
		if (!this.scopePushed) return;
		this.app.keymap.popScope(this.hotkeyScope);
		this.scopePushed = false;
	}

	private renderReact(): void {
		render(
			<ReviewView
				component={this}
				phase={this.phase}
				onGrade={(n) => this.onGrade(n)}
				onShowAnswer={() => this.onEnter()}
				queueStats={this.queueStats}
				sessionStats={this.sessionStats}
				upcomingInfo={this.getUpcomingInfo()}
			/>,
			this.contentEl,
		);
		this.mounted = true;
	}

	private async refreshQueue(): Promise<void> {
		const now = new Date();
		this.queue = await buildQueue(this.appRef, now, this.pluginRef.settings.extractTag);
		this.queueStats = getQueueStats(this.queue);
		this.current = getNextCard(this.queue);
	}


	public getCurrentCard(): TFile | null {
		return this.current?.file ?? null;
	}

	public getQueueStats(): QueueStats {
		return this.queueStats;
	}

	public getSessionStats(): SessionStats {
		return this.sessionStats;
	}

	public getUpcomingInfo(): { nextDue: Date | null; upcomingCount: number } {
		return {
			nextDue: this.queue?.nextDue ?? null,
			upcomingCount: this.queue?.upcomingCount ?? 0,
		};
	}

	private onEnter(): void {
		void this.onEnterAsync();
	}

	private async onEnterAsync(): Promise<void> {
		if (this.phase === 'question') {
			this.phase = 'answer';
			this.currentGrade = null;
		} else {
			if (this.currentGrade == null) this.currentGrade = 3;
			await this.advanceCard(this.currentGrade);
			this.phase = 'question';
			this.currentGrade = null;
		}
		this.renderReact();
	}

	private onGrade(n: number): void {
		void this.onGradeAsync(n);
	}

	private async onGradeAsync(n: number): Promise<void> {
		this.currentGrade = n;

		if (this.phase === 'answer') {
			await this.advanceCard(n);
			this.phase = 'question';
			this.currentGrade = null;
		}

		this.renderReact();
	}

	private async advanceCard(grade: number): Promise<void> {
		const entry = this.current;
		if (!entry) {
			await this.refreshQueue();
			return;
		}

		const now = new Date();
		let updated: CardState;

		if (entry.state.type === 'topic') {
			const scrollPos = this.getScrollPosition();
			updated = this.gradeTopic(entry.state, grade, now, scrollPos);
		} else {
			const rating = this.mapGradeToRating(grade);
			updated = gradeCard(this.scheduler, entry.state, rating, now);
		}

		this.recordSessionGrade(grade);
		await writeCardState(this.appRef, entry.file, updated, this.pluginRef.settings.extractTag);

		await this.refreshQueue();
	}

	getApp() {
		return this.appRef;
	}

	private shouldIgnoreHotkeyEvent(evt: KeyboardEvent): boolean {
		// Never steal keys while typing in an input, textarea, or contenteditable.
		const target = evt.target as HTMLElement | null;
		if (!target) return false;
		const tag = target.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
		if (target.isContentEditable) return true;
		return false;
	}

	private onPointerDown(evt: MouseEvent): void {
		// If the click is on a text input, don't steal focus.
		const target = evt.target as HTMLElement | null;
		if (target) {
			const tag = target.tagName?.toLowerCase();
			if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
			if (target.isContentEditable) return;
		}
		// Ensure the view root is focused so key events land here.
		this.contentEl.focus();
	}

	private onKeyDownFallback(evt: KeyboardEvent): void {
		if (this.shouldIgnoreHotkeyEvent(evt)) return;

		// Don't interfere with modifiers.
		if (evt.ctrlKey || evt.metaKey || evt.altKey) return;

		if (evt.key === 'Enter') {
			evt.preventDefault();
			this.onEnter();
			return;
		}
		if (evt.key === ' ') {
			evt.preventDefault();
			this.onEnter();
			return;
		}
		// Grades 1-4
		if (evt.key >= '1' && evt.key <= '4') {
			evt.preventDefault();
			this.onGrade(Number(evt.key));
		}
	}

	private gradeTopic(state: CardState, grade: number, now: Date, scrollPos: number): CardState {
		const clamped = Math.max(1, Math.min(4, grade));
		let due: Date;
		switch (clamped) {
			case 1:
				due = addMinutes(now, 10);
				break;
			case 2:
				due = addDays(now, 1);
				break;
			case 3:
				due = addDays(now, 3);
				break;
			default:
				due = addDays(now, 7);
				break;
		}

		const status: Status = clamped === 1 ? 'learning' : 'review';
		return {
			...state,
			due,
			status,
			reps: state.reps + 1,
			lapses: state.lapses + (clamped === 1 ? 1 : 0),
			last_review: now,
			scroll_pos: scrollPos,
		};
	}

	private mapGradeToRating(grade: number): Rating {
		switch (grade) {
			case 1:
				return Rating.Again;
			case 2:
				return Rating.Hard;
			case 4:
				return Rating.Easy;
			default:
				return Rating.Good;
		}
	}

	private recordSessionGrade(grade: number): void {
		this.sessionStats.reviewed += 1;
		switch (grade) {
			case 1:
				this.sessionStats.again += 1;
				break;
			case 2:
				this.sessionStats.hard += 1;
				break;
			case 4:
				this.sessionStats.easy += 1;
				break;
			default:
				this.sessionStats.good += 1;
		}
	}

	private getScrollPosition(): number {
		const scrollEl = this.contentEl.querySelector<HTMLElement>('.ir-review-scroll');
		if (!scrollEl) return 0;
		return scrollEl.scrollTop;
	}
}

export interface SessionStats {
	started: Date;
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
