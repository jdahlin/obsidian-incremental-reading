import { App, Modal, Setting, SliderComponent, TextComponent } from 'obsidian';

export class PriorityModal extends Modal {
	private onSubmit: (result: number) => void;

	constructor(
		app: App,
		private currentPriority: number,
		onSubmit: (result: number) => void,
	) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Set priority' });
		contentEl.createEl('p', { text: '0 (highest) - 100 (lowest)' });

		let value = this.currentPriority;
		let textComponent: TextComponent | null = null;
		let sliderComponent: SliderComponent | null = null;

		const controlsDiv = contentEl.createDiv();

		new Setting(controlsDiv)
			.setName('Value')
			.addText((text) => {
				textComponent = text;
				text.setValue(String(value));
				text.inputEl.setCssProps({ width: '60px' });
				text.onChange((newValue) => {
					const parsed = parseInt(newValue, 10);
					if (!Number.isNaN(parsed)) {
						const clamped = Math.max(0, Math.min(100, parsed));
						value = clamped;
						if (sliderComponent) {
							sliderComponent.setValue(clamped);
						}
					}
				});
				text.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						this.submit(value);
					}
				});
			})
			.addSlider((slider) => {
				sliderComponent = slider;
				slider.setLimits(0, 100, 1);
				slider.setValue(value);
				slider.setDynamicTooltip();
				slider.onChange((newValue) => {
					value = newValue;
					if (textComponent) {
						textComponent.setValue(String(newValue));
					}
				});
			});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					this.submit(value);
				}),
		);

		setTimeout(() => {
			textComponent?.inputEl.focus();
			textComponent?.inputEl.select();
		}, 0);
	}

	private submit(value: number): void {
		const clamped = Math.max(0, Math.min(100, value));
		this.onSubmit(clamped);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
