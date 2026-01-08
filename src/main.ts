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

	onunload(): void {
		// Obsidian handles view teardown.
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<IncrementalReadingSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
