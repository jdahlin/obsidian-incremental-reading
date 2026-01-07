import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { registerCommands } from './commands';
import { normalizeNumber } from './core/frontmatter';
import { ensureBasesFolder } from './bases';
import { clozeHiderExtension } from './editor/cloze-hider';
import { exportReviewHistory } from './data/export';
import { runMigration } from './migration';
import { DEFAULT_SETTINGS, IncrementalReadingSettingTab, type IncrementalReadingSettings } from './settings';
import { PriorityModal } from './ui/PriorityModal';
import { StatsModal } from './views/stats/StatsModal';
import { ReviewItemView, VIEW_TYPE_REVIEW } from './views/review/ReviewItemView';

export default class IncrementalReadingPlugin extends Plugin {
	settings: IncrementalReadingSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		if (this.settings.migrationVersion < 1) {
			await runMigration(this.app, this.settings.extractTag);
			this.settings.migrationVersion = 1;
			await this.saveSettings();
		}
		this.addSettingTab(new IncrementalReadingSettingTab(this.app, this));
		registerCommands(this);
		this.registerEditorExtension(clozeHiderExtension);
		this.registerView(VIEW_TYPE_REVIEW, (leaf: WorkspaceLeaf) => new ReviewItemView(leaf, this.app, this));

		void ensureBasesFolder(this.app).catch((error) => {
			console.error('IR: failed to ensure bases folder', error);
		});

		this.addCommand({
			id: 'open-review-view',
			name: 'Open review',
			callback: async () => {
				await this.activateReviewView();
			},
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
			},
		});

		this.addCommand({
			id: 'export-review-history',
			name: 'Export review history',
			callback: () => {
				void (async () => {
					const file = await exportReviewHistory(this.app);
					new Notice(`Exported review history to ${file.path}.`);
				})();
			},
		});

		this.addCommand({
			id: 'open-statistics',
			name: 'Open statistics',
			callback: () => {
				new StatsModal(this.app, this.settings.extractTag).open();
			},
		});
	}

	onunload(): void {
		// Obsidian handles view teardown.
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<IncrementalReadingSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async openPriorityModal(file: TFile): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
		const current = normalizeNumber(frontmatter?.priority, 50);

		new PriorityModal(this.app, current, (newPriority) => {
			void (async () => {
				await this.app.fileManager.processFrontMatter(file, (fm) => {
					const data = fm as Record<string, unknown>;
					data.priority = newPriority;
				});
				new Notice(`Priority set to ${newPriority}.`);
			})();
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
	}
}
