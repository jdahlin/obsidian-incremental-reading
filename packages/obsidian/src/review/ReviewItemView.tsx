import type { App, ViewStateResult, WorkspaceLeaf } from 'obsidian'
import type { EngineReviewController } from '../adapters'
import type IncrementalReadingPlugin from '../main'
import type { ReviewViewState } from './review-screen-state'
import { ItemView } from 'obsidian'
import { render } from 'preact'
import { ReviewRoot } from './ReviewRoot'
import './ReviewItemView.css'

export const VIEW_TYPE_REVIEW = 'ir-review'

/** Internal Obsidian leaf history API */
interface LeafHistory {
	pushState: (entry: { state: unknown; title: string; icon: string }) => void
}

export class ReviewItemView extends ItemView {
	private mounted = false
	navigation = true
	controller: EngineReviewController | null = null

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private pluginRef: IncrementalReadingPlugin,
	) {
		super(leaf)
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW
	}

	getDisplayText(): string {
		return 'Incremental reading'
	}

	getState(): ReviewViewState {
		return this.controller?.getSerializableState() ?? { screen: 'folder' }
	}

	async setState(state: ReviewViewState, _result: ViewStateResult): Promise<void> {
		if (this.controller && state) {
			await this.controller.restoreState(state)
		}
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty()
		this.contentEl.addClass('ir-review-view')
		render(
			<ReviewRoot
				app={this.appRef}
				view={this}
				settings={this.pluginRef.settings}
				onControllerReady={this.handleControllerReady}
			/>,
			this.contentEl,
		)
		this.mounted = true
	}

	async onClose(): Promise<void> {
		if (this.mounted) {
			render(null, this.contentEl)
			this.mounted = false
		}
		this.contentEl.empty()
	}

	private handleControllerReady = (controller: EngineReviewController): void => {
		this.controller = controller
		controller.onHistoryChange = (state) => this.pushHistory(state)
	}

	private pushHistory(state: ReviewViewState): void {
		const history = (this.leaf as unknown as { history?: LeafHistory }).history
		history?.pushState({
			state: { type: VIEW_TYPE_REVIEW, state },
			title: this.getDisplayText(),
			icon: 'lucide-file',
		})
	}
}
