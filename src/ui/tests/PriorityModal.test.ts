import { describe, expect, it } from 'vitest';
import { App, Setting, TextComponent, SliderComponent, ButtonComponent } from 'obsidian';
import { PriorityModal } from '../PriorityModal';

function getComponents() {
	const entries = Setting.createdComponents;
	const text = entries.find((entry) => entry.type === 'text')?.component as TextComponent;
	const slider = entries.find((entry) => entry.type === 'slider')?.component as SliderComponent;
	const button = entries.find((entry) => entry.type === 'button')?.component as ButtonComponent;
	return { text, slider, button };
}

describe('PriorityModal', () => {
	it('syncs slider and text inputs and clamps on submit', () => {
		const app = new App();
		let submitted: number | null = null;
		Setting.resetComponents();
		const modal = new PriorityModal(app, 20, (value) => {
			submitted = value;
		});

		modal.open();
		const { text, slider, button } = getComponents();

		slider.triggerChange(42);
		expect(text.inputEl.textContent).toBe('42');

		text.triggerChange('150');
		button.triggerClick();
		expect(submitted).toBe(100);
	});

	it('empties content on close', () => {
		const app = new App();
		const modal = new PriorityModal(app, 10, () => undefined);
		modal.open();
		expect(modal.contentEl.children.length).toBeGreaterThan(0);
		modal.close();
		expect(modal.contentEl.children).toHaveLength(0);
	});
});
