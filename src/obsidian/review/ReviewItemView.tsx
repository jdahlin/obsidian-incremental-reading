import { render } from 'preact';
import { App, ItemView, WorkspaceLeaf } from 'obsidian';
import type IncrementalReadingPlugin from '../../main';
import { ReviewRoot } from './ReviewRoot';
import './ReviewItemView.css';

export const VIEW_TYPE_REVIEW = 'ir-review';

export class ReviewItemView extends ItemView {
	private mounted = false;

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private pluginRef: IncrementalReadingPlugin,
	) {
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
		render(
			<ReviewRoot app={this.appRef} view={this} settings={this.pluginRef.settings} />,
			this.getRenderContainer(),
		);
		this.mounted = true;
	}

	async onClose(): Promise<void> {
		if (this.mounted) {
			render(null, this.getRenderContainer());
			this.mounted = false;
		}
		this.contentEl.empty();
	}

	private getRenderContainer(): HTMLElement {
		return this.contentEl as unknown as HTMLElement;
	}
}
