import { App, PluginSettingTab, Setting } from 'obsidian';
import type IncrementalReadingPlugin from './main';

export interface IncrementalReadingSettings {
	newCardsPerDay: number;
	maximumInterval: number;
	requestRetention: number;
	extractTag: string;
	extractTitleWords: number;
	trackReviewTime: boolean;
	showStreak: boolean;
}

export const DEFAULT_SETTINGS: IncrementalReadingSettings = {
	newCardsPerDay: 10,
	maximumInterval: 365,
	requestRetention: 0.9,
	extractTag: 'topic',
	extractTitleWords: 5,
	trackReviewTime: true,
	showStreak: true,
};

export class IncrementalReadingSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: IncrementalReadingPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('New cards per day')
			.setDesc('Maximum number of new items introduced per day.')
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.newCardsPerDay))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (Number.isFinite(parsed)) {
							this.plugin.settings.newCardsPerDay = Math.max(0, parsed);
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName('Maximum interval (days)')
			.setDesc('Upper bound for scheduling intervals.')
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.maximumInterval))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (Number.isFinite(parsed)) {
							this.plugin.settings.maximumInterval = Math.max(1, parsed);
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName('Request retention')
			.setDesc('Target retention for scheduling (0 to 1).')
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.requestRetention))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (Number.isFinite(parsed)) {
							this.plugin.settings.requestRetention = Math.min(1, Math.max(0, parsed));
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName('Extract tag')
			.setDesc('Tag used to mark incremental reading notes.')
			.addText((text) => {
				text
					.setValue(this.plugin.settings.extractTag)
					.onChange(async (value) => {
						this.plugin.settings.extractTag = value.trim() || 'topic';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Extract title words')
			.setDesc('Number of words to use when naming extracted notes.')
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.extractTitleWords))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (Number.isFinite(parsed)) {
							this.plugin.settings.extractTitleWords = Math.max(1, parsed);
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName('Track review time')
			.setDesc('Store elapsed time per review in the revlog.')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.trackReviewTime)
					.onChange(async (value) => {
						this.plugin.settings.trackReviewTime = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Show streak')
			.setDesc('Display the review streak in the deck summary.')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showStreak)
					.onChange(async (value) => {
						this.plugin.settings.showStreak = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
