import type { App, WorkspaceLeaf } from 'obsidian'
import type IncrementalReadingPlugin from '../main'
import { ItemView } from 'obsidian'
import { render } from 'preact'
import { StatsRoot } from './StatsRoot'
import './StatsView.css'

export const VIEW_TYPE_STATS = 'ir-stats'

export class StatsView extends ItemView {
	private mounted = false

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private pluginRef: IncrementalReadingPlugin,
	) {
		super(leaf)
	}

	getViewType(): string {
		return VIEW_TYPE_STATS
	}

	getDisplayText(): string {
		return 'Statistics'
	}

	getIcon(): string {
		return 'bar-chart-2'
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty()
		this.contentEl.addClass('ir-stats-view')
		render(<StatsRoot app={this.appRef} settings={this.pluginRef.settings} />, this.contentEl)
		this.mounted = true
	}

	async onClose(): Promise<void> {
		if (this.mounted) {
			render(null, this.contentEl)
			this.mounted = false
		}
		this.contentEl.empty()
	}
}
