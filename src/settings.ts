import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type IncrementalReadingPlugin from './main';

export interface PluginSettings {
	newCardsPerDay: number;
	reviewOrder: 'due-first' | 'new-first' | 'mixed';
	maximumInterval: number;
	requestRetention: number;
	fsrsParameters: number[];
	extractTitleWords: number;
	extractTag: string;
	showNextReviewTime: boolean;
	autoAdvanceDelay: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	newCardsPerDay: 20,
	reviewOrder: 'due-first',
	maximumInterval: 365,
	requestRetention: 0.9,
	fsrsParameters: [
		0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
		0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
		0.0912, 0.0658, 0.1542,
	],
	extractTitleWords: 5,
	extractTag: 'topic',
	showNextReviewTime: false,
	autoAdvanceDelay: 0,
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
			.setDesc('Limit how many new cards are introduced each day (0 = unlimited).')
			.addText((text) =>
				text
					.setPlaceholder('20')
					.setValue(String(this.plugin.settings.newCardsPerDay))
					.onChange(async (value) => {
						const num = Number(value);
						this.plugin.settings.newCardsPerDay = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Review order')
			.setDesc('Choose which cards surface first in mixed sessions.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('due-first', 'Due first')
					.addOption('new-first', 'New first')
					.addOption('mixed', 'Mixed')
					.setValue(this.plugin.settings.reviewOrder)
					.onChange(async (value) => {
						this.plugin.settings.reviewOrder = value as PluginSettings['reviewOrder'];
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Maximum interval (days)')
			.setDesc('Longest possible gap between reviews.')
			.addText((text) =>
				text
					.setPlaceholder('365')
					.setValue(String(this.plugin.settings.maximumInterval))
					.onChange(async (value) => {
						const num = Number(value);
						this.plugin.settings.maximumInterval = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : 365;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Request retention')
			.setDesc('Target recall rate for scheduling (70 - 99%).')
			.addText((text) =>
				text
					.setPlaceholder('0.9')
					.setValue(String(Math.round(this.plugin.settings.requestRetention * 100)))
					.onChange(async (value) => {
						const num = Number(value);
						if (Number.isFinite(num)) {
							const normalized = num / 100;
							this.plugin.settings.requestRetention = Math.min(0.99, Math.max(0.7, normalized));
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName('Extract title words')
			.setDesc('Number of words to use when naming a new extract.')
			.addText((text) =>
				text
					.setPlaceholder('5')
					.setValue(String(this.plugin.settings.extractTitleWords))
					.onChange(async (value) => {
						const num = Number(value);
						this.plugin.settings.extractTitleWords = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : 5;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Topic tag')
			.setDesc('Tag applied to topic/item notes so they appear in review queues.')
			.addText((text) =>
				text
					.setPlaceholder('topic')
					.setValue(this.plugin.settings.extractTag)
					.onChange(async (value) => {
						this.plugin.settings.extractTag = value.trim() || DEFAULT_SETTINGS.extractTag;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show next review time')
			.setDesc('Show the scheduled interval on grade buttons.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showNextReviewTime).onChange(async (value) => {
					this.plugin.settings.showNextReviewTime = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Auto-advance delay (ms)')
			.setDesc('Wait before advancing to the next card (0 = instant).')
			.addText((text) =>
				text
					.setPlaceholder('0')
					.setValue(String(this.plugin.settings.autoAdvanceDelay))
					.onChange(async (value) => {
						const num = Number(value);
						this.plugin.settings.autoAdvanceDelay = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('FSRS parameters')
			.setDesc('Paste the full FSRS weight array (21 numbers).')
			.addTextArea((text) => {
				text
					.setPlaceholder('[0.212, 1.2931, ...]')
					.setValue(`[${this.plugin.settings.fsrsParameters.join(', ')}]`)
					.onChange(async (value) => {
						const parsed = parseFsrsParameters(value);
						if (!parsed) {
							new Notice('FSRS parameters must be 21 numbers.');
							return;
						}
						this.plugin.settings.fsrsParameters = parsed;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = '100%';
				text.inputEl.style.minHeight = '6rem';
			});
	}
}

function parseFsrsParameters(value: string): number[] | null {
	const numbers = value
		.replace(/[\[\]]/g, '')
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((num) => Number.isFinite(num));
	if (numbers.length !== 21) return null;
	return numbers;
}
