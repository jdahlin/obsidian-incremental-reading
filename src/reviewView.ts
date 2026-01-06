import './reviewView.css';
import { App, ItemView, Scope, WorkspaceLeaf, TFile } from 'obsidian';
import { renderMarkdownToEl } from './markdown';
import { getNotesWithTag } from './search';

export const VIEW_TYPE_REVIEW = 'my-review';

type Phase = 'question' | 'answer';

export class ReviewView extends ItemView {
	private phase: Phase = 'question';
	private currentGrade: number | null = null;

	private queue: TFile[] = [];
	private index = 0;

	constructor(leaf: WorkspaceLeaf, private appRef: App) {
		super(leaf);

		// View-specific hotkeys via a scoped key handler.
		this.scope = new Scope(this.app.scope);

		for (let n = 1; n <= 5; n++) {
			this.scope.register([], String(n), () => {
				this.onGrade(n);
				return true;
			});
			this.scope.register([], `Numpad${n}`, () => {
				this.onGrade(n);
				return true;
			});
		}

		this.scope.register([], 'Enter', () => {
			this.onEnter();
			return true;
		});
		this.scope.register([], 'NumpadEnter', () => {
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

		this.refreshQueue();
		await this.render();
		this.contentEl.focus();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private refreshQueue(): void {
		this.queue = getNotesWithTag(this.appRef, '#extract');
		this.index = Math.min(this.index, Math.max(0, this.queue.length - 1));
	}

	private getCurrentCard(): TFile | null {
		return this.queue[this.index] ?? null;
	}

	private async render(): Promise<void> {
		const el = this.contentEl;
		el.empty();

		// Root container so CSS can make the whole view fill the leaf.
		const root = el.createDiv({ cls: 'ir-review-root' });
		const scroll = root.createDiv({ cls: 'ir-review-scroll' });
		const footer = root.createDiv({ cls: 'ir-review-footer' });

		const card = this.getCurrentCard();

		const body = scroll.createDiv({ cls: 'ir-review-card' });
		if (!card) {
			body.setText('No #extract notes found.');
			this.renderGradeBar(footer);
			return;
		}

		const markdown = await this.appRef.vault.cachedRead(card);
		await renderMarkdownToEl(this.appRef, markdown, body, card.path, this);

		this.renderGradeBar(footer);
	}

	private renderGradeBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: 'ir-review-gradebar' });

		const labels = ["Again", "Hard", "Good", "Easy"];
		for (let n = 1; n <= 4; n++) {
			const btn = bar.createEl('button', {
				cls: 'ir-review-gradebtn',
				text: labels[n-1] + ` [${n}]`,
			});
			btn.addEventListener('click', () => this.onGrade(n));
		}
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
			this.advanceCard(this.currentGrade);
			this.phase = 'question';
			this.currentGrade = null;
		}
		await this.render();
	}

	private onGrade(n: number): void {
		void this.onGradeAsync(n);
	}

	private async onGradeAsync(n: number): Promise<void> {
		this.currentGrade = n;

		if (this.phase === 'answer') {
			this.advanceCard(n);
			this.phase = 'question';
			this.currentGrade = null;
		}

		await this.render();
	}

	private advanceCard(_grade: number): void {
		// TODO: log repetition, schedule next, advance to next card
		this.refreshQueue();
		if (this.queue.length === 0) {
			this.index = 0;
			return;
		}
		this.index = (this.index + 1) % this.queue.length;
	}
}
