import { Editor, MarkdownView, Plugin, WorkspaceLeaf } from 'obsidian';
import { clozeSelectionNextIndex, clozeSelectionSameIndex } from './commands/cloze';
import { extractToIncrementalNote } from './commands/extract';
import { ReviewItemView, VIEW_TYPE_REVIEW } from './views/review';
import { ensureBasesFolder } from './bases';
import { DEFAULT_SETTINGS, IncrementalReadingSettingTab, type PluginSettings } from './settings';

export default class IncrementalReadingPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		const basesTimeout = window.setTimeout(() => {
			void ensureBasesFolder(this.app).catch((err) => {
				console.error('IR: failed to ensure bases folder', err);
			});
		}, 0);
		this.register(() => window.clearTimeout(basesTimeout));
		this.addSettingTab(new IncrementalReadingSettingTab(this.app, this));
		this.registerView(VIEW_TYPE_REVIEW, (leaf: WorkspaceLeaf) => new ReviewItemView(leaf, this.app, this));

		this.addRibbonIcon('dice', 'Review', async () => {
			await this.activateReviewView();
		});

		this.addCommand({
			id: 'open-review-view',
			name: 'Open review',
			callback: async () => {
				await this.activateReviewView();
			}
		});

		this.addCommand({
			id: 'extract-to-incremental-note',
			name: 'Extract to incremental note',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await extractToIncrementalNote(this, editor, view, {
					titleWords: this.settings.extractTitleWords,
					tag: this.settings.extractTag,
				});
			},
			hotkeys: [{ modifiers: ['Alt'], key: 'X' }],
		});

		this.addCommand({
			id: 'cloze-selection',
			name: 'Cloze selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				// Default title is "..." for now.
				await clozeSelectionNextIndex(this.app, editor, view.file, {
					title: '...',
					extractTag: this.settings.extractTag,
				});
			},
			hotkeys: [{ modifiers: ['Alt'], key: 'Z' }],
		});

		this.addCommand({
			id: 'cloze-selection-same-index',
			name: 'Cloze selection (same index)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await clozeSelectionSameIndex(this.app, editor, view.file, {
					title: '...',
					extractTag: this.settings.extractTag,
				});
			},
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'Z' }],
		});
	}

	onunload() {
		// Don't detach leaves here; users may have moved the view.
		// Obsidian will unload the view type when the plugin is disabled.
	}

	private async activateReviewView(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0];
		if (!leaf) {
			const mostRecent = workspace.getMostRecentLeaf();
			if (!mostRecent) return;
			leaf = mostRecent;
			await leaf.setViewState({ type: VIEW_TYPE_REVIEW, active: true });
		}
		void workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof ReviewItemView) {
			view.contentEl.focus();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
