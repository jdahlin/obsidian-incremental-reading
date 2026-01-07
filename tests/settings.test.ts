import { describe, expect, it } from 'vitest';
import { App, Setting, TextComponent, ToggleComponent } from 'obsidian';
import { IncrementalReadingSettingTab, DEFAULT_SETTINGS } from '../src/settings';

function makePlugin() {
	return {
		settings: { ...DEFAULT_SETTINGS },
		saveSettingsCalls: 0,
		async saveSettings() {
			this.saveSettingsCalls += 1;
		},
	};
}

describe('IncrementalReadingSettingTab', () => {
	it('wires settings inputs and persists changes', () => {
		const app = new App();
		const plugin = makePlugin();

		Setting.resetComponents();
		const tab = new IncrementalReadingSettingTab(app, plugin as never);
		tab.display();

		const types = Setting.createdComponents.map((entry) => entry.type);
		expect(types).toEqual(['text', 'text', 'text', 'text', 'text', 'toggle', 'toggle']);

		const [newCards, maxInterval, retention, tag, titleWords, trackToggle, streakToggle] = Setting.createdComponents
			.map((entry) => entry.component) as [TextComponent, TextComponent, TextComponent, TextComponent, TextComponent, ToggleComponent, ToggleComponent];

		newCards.triggerChange('25');
		maxInterval.triggerChange('120');
		retention.triggerChange('0.75');
		tag.triggerChange('  custom  ');
		titleWords.triggerChange('3');
		trackToggle.triggerChange(false);
		streakToggle.triggerChange(false);

		expect(plugin.settings.newCardsPerDay).toBe(25);
		expect(plugin.settings.maximumInterval).toBe(120);
		expect(plugin.settings.requestRetention).toBe(0.75);
		expect(plugin.settings.extractTag).toBe('custom');
		expect(plugin.settings.extractTitleWords).toBe(3);
		expect(plugin.settings.trackReviewTime).toBe(false);
		expect(plugin.settings.showStreak).toBe(false);
		expect(plugin.saveSettingsCalls).toBeGreaterThan(0);
	});
});
