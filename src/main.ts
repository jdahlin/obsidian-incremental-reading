import { Editor, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { clozeSelectionNextIndex, clozeSelectionSameIndex } from './commands/cloze';
import { extractToIncrementalNote } from './commands/extract';
import { ReviewItemView, VIEW_TYPE_REVIEW } from './views/review';
import { ensureBasesFolder } from './bases';
import { DEFAULT_SETTINGS, IncrementalReadingSettingTab, type PluginSettings } from './settings';
import { readCardState, writeCardState } from './scheduling/frontmatter';
import { PriorityModal } from './ui/PriorityModal';

export default class IncrementalReadingPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	machineId = '';

	async onload() {
		await this.loadSettings();
		await this.ensureMachineId();
		this.checkBasesEnabled();
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
			id: 'set-priority',
			name: 'Set priority',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					if (!checking) {
						void this.openPriorityModal(file);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'extract-to-incremental-note',
			name: 'Extract to topic note',
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

	private checkBasesEnabled() {
		// @ts-ignore - internalPlugins is not in public types
		const internalPlugins = (this.app as any).internalPlugins;
		if (internalPlugins) {
			const bases = internalPlugins.getPluginById('bases');
			if (bases && !bases.enabled) {
				// Use a timeout to ensure the notice appears after startup clutter
				setTimeout(() => {
					new Notice("Incremental Reading: The 'Bases' core plugin is currently disabled. Please enable it in Settings > Core Plugins to browse your card database.", 6000);
				}, 2000);
			}
		}
	}

	onunload() {
		// Don't detach leaves here; users may have moved the view.
		// Obsidian will unload the view type when the plugin is disabled.
	}

	private async openPriorityModal(file: TFile): Promise<void> {
		const state = await readCardState(this.app, file, this.settings.extractTag);
		if (!state) {
			new Notice(`Current file is not an incremental reading card (missing #${this.settings.extractTag} tag).`);
			return;
		}
		new PriorityModal(this.app, state.priority, async (newPriority) => {
			const newState = { ...state, priority: newPriority };
			await writeCardState(this.app, file, newState, this.settings.extractTag);
			new Notice(`Priority set to ${newPriority}`);
		}).open();
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

	private async ensureMachineId(): Promise<void> {
		const idPath = `.obsidian/plugins/${this.manifest.id}/machine-id.txt`;
		const adapter = this.app.vault.adapter;
		const folderPath = idPath.split('/').slice(0, -1).join('/');

		if (await adapter.exists(idPath)) {
			const existing = (await adapter.read(idPath)).trim();
			if (existing) {
				this.machineId = existing;
				return;
			}
		}

		if (!await adapter.exists(folderPath)) {
			await adapter.mkdir(folderPath);
		}

		this.machineId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `ir-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
		await adapter.write(idPath, `${this.machineId}\n`);
	}
}
