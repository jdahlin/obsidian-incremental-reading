import { App, PluginSettingTab, Setting } from 'obsidian';
import type IncrementalReadingPlugin from './main';

export interface IncrementalReadingSettings {
	newCardsPerDay: number;
	maximumInterval: number;
	requestRetention: number;
	extractTag: string;
	extractTitleWords: number;
	createFolderForExtractedTopics: boolean;
	trackReviewTime: boolean;
	showStreak: boolean;
}

export const DEFAULT_SETTINGS: IncrementalReadingSettings = {
	newCardsPerDay: 10,
	maximumInterval: 365,
	requestRetention: 0.9,
	extractTag: 'topic',
	extractTitleWords: 5,
	createFolderForExtractedTopics: false,
	trackReviewTime: true,
	showStreak: true,
};

export class IncrementalReadingSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		public plugin: IncrementalReadingPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('New cards per day')
			.setDesc('Maximum number of new items introduced per day.')
			.addText((text) => {
				text.setValue(String(this.plugin.settings.newCardsPerDay)).onChange((value) => {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						this.plugin.settings.newCardsPerDay = Math.max(0, parsed);
						void this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Maximum interval (days)')
			.setDesc('Upper bound for scheduling intervals.')
			.addText((text) => {
				text.setValue(String(this.plugin.settings.maximumInterval)).onChange((value) => {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						this.plugin.settings.maximumInterval = Math.max(1, parsed);
						void this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Request retention')
			.setDesc('Target retention for scheduling (0 to 1).')
			.addText((text) => {
				text.setValue(String(this.plugin.settings.requestRetention)).onChange((value) => {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						this.plugin.settings.requestRetention = Math.min(1, Math.max(0, parsed));
						void this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Extract tag')
			.setDesc('Tag used to mark incremental reading notes.')
			.addText((text) => {
				text.setValue(this.plugin.settings.extractTag).onChange((value) => {
					this.plugin.settings.extractTag = value.trim() || 'topic';
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Extract title words')
			.setDesc('Number of words to use when naming extracted notes.')
			.addText((text) => {
				text.setValue(String(this.plugin.settings.extractTitleWords)).onChange((value) => {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						this.plugin.settings.extractTitleWords = Math.max(1, parsed);
						void this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Create folder for extracted topics')
			.setDesc(
				'When extracting from a note that is not a folder note, create a folder and move the source note into it.',
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.createFolderForExtractedTopics)
					.onChange((value) => {
						this.plugin.settings.createFolderForExtractedTopics = value;
						void this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Track review time')
			.setDesc('Store elapsed time per review in the revlog.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.trackReviewTime).onChange((value) => {
					this.plugin.settings.trackReviewTime = value;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Show streak')
			.setDesc('Display the review streak in the deck summary.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showStreak).onChange((value) => {
					this.plugin.settings.showStreak = value;
					void this.plugin.saveSettings();
				});
			});
	}
}
