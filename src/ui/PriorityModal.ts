import { App, Modal, Setting, SliderComponent, TextComponent } from 'obsidian';

export class PriorityModal extends Modal {
	private onSubmit: (result: number) => void;

	constructor(app: App, private currentPriority: number, onSubmit: (result: number) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Set Priority' });
		contentEl.createEl('p', { text: '0 (Highest) - 100 (Lowest)' });

		let value = this.currentPriority;
		let textComponent: TextComponent | null = null;
		let sliderComponent: SliderComponent | null = null;

		// Container for controls to keep them close
		const controlsDiv = contentEl.createDiv();

		// Text Input Setting
		new Setting(controlsDiv)
			.setName('Value')
			.addText((text) => {
				textComponent = text;
				text.setValue(String(value));
				text.inputEl.style.width = '60px'; // Make it compact
				text.onChange((newValue) => {
					const parsed = parseInt(newValue, 10);
					if (!isNaN(parsed)) {
						const clamped = Math.max(0, Math.min(100, parsed));
						value = clamped;
						// Sync slider
						if (sliderComponent) {
							sliderComponent.setValue(clamped);
						}
					}
				});
				// Handle Enter key in input
				text.inputEl.addEventListener('keydown', (evt) => {
					if (evt.key === 'Enter') {
						evt.preventDefault();
						this.submit(value);
					}
				});
			})
			// Slider Setting (merged into same line if possible, or separate)
			.addSlider((slider) => {
				sliderComponent = slider;
				slider.setLimits(0, 100, 1);
				slider.setValue(value);
				slider.setDynamicTooltip();
				slider.onChange((newValue) => {
					value = newValue;
					// Sync text
					if (textComponent) {
						textComponent.setValue(String(newValue));
					}
				});
			});

		// Save Button
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(() => {
						this.submit(value);
					})
			);
		
		// Focus input on open
		setTimeout(() => {
			textComponent?.inputEl.focus();
			textComponent?.inputEl.select();
		}, 0);
	}

	private submit(value: number) {
		const clamped = Math.max(0, Math.min(100, value));
		this.onSubmit(clamped);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}