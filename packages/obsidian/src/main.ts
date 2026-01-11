import type { WorkspaceLeaf } from 'obsidian'
import type { IncrementalReadingSettings } from './settings'
import { Plugin } from 'obsidian'
import { ensureBasesFolder } from './bases'
import { registerCommands } from './commands'
import { clozeHiderExtension } from './editor/cloze-hider'
import { ReviewItemView, VIEW_TYPE_REVIEW } from './review/ReviewItemView'
import { DEFAULT_SETTINGS, IncrementalReadingSettingTab } from './settings'

export default class IncrementalReadingPlugin extends Plugin {
	settings: IncrementalReadingSettings = DEFAULT_SETTINGS

	async onload(): Promise<void> {
		await this.loadSettings()
		this.addSettingTab(new IncrementalReadingSettingTab(this.app, this))
		registerCommands(this)
		this.registerEditorExtension(clozeHiderExtension)
		this.registerView(
			VIEW_TYPE_REVIEW,
			(leaf: WorkspaceLeaf) => new ReviewItemView(leaf, this.app, this),
		)
		void ensureBasesFolder(this.app).catch((error) => {
			console.error('IR: failed to ensure bases folder', error)
		})
	}

	/** Open (or reveal) the Review view in the workspace. */
	async activateReviewView(): Promise<void> {
		const { workspace } = this.app
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0]
		if (!leaf) {
			const mostRecent = workspace.getMostRecentLeaf()
			if (!mostRecent) return
			leaf = mostRecent
			await leaf.setViewState({ type: VIEW_TYPE_REVIEW, active: true })
		}
		await workspace.revealLeaf(leaf)
		workspace.setActiveLeaf(leaf, { focus: true })
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<IncrementalReadingSettings> | null
		this.settings = { ...DEFAULT_SETTINGS, ...stored }
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}
}
