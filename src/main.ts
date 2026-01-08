import { Plugin, WorkspaceLeaf } from 'obsidian';
import { registerCommands } from './commands';
import { ensureBasesFolder } from './bases';
import { clozeHiderExtension } from './editor/cloze-hider';
import {
	DEFAULT_SETTINGS,
	IncrementalReadingSettingTab,
	type IncrementalReadingSettings,
} from './settings';
import { ReviewItemView, VIEW_TYPE_REVIEW } from './views/review/ReviewItemView';

export default class IncrementalReadingPlugin extends Plugin {
	settings: IncrementalReadingSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new IncrementalReadingSettingTab(this.app, this));
		registerCommands(this);
		this.registerEditorExtension(clozeHiderExtension);
		this.registerView(
			VIEW_TYPE_REVIEW,
			(leaf: WorkspaceLeaf) => new ReviewItemView(leaf, this.app, this),
		);
		void ensureBasesFolder(this.app).catch((error) => {
			console.error('IR: failed to ensure bases folder', error);
		});
	}

	/** Open (or reveal) the Review view in the workspace. */
	async activateReviewView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0];
		if (!leaf) {
			const mostRecent = workspace.getMostRecentLeaf();
			if (!mostRecent) return;
			leaf = mostRecent;
			await leaf.setViewState({ type: VIEW_TYPE_REVIEW, active: true });
		}
		void workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<IncrementalReadingSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
