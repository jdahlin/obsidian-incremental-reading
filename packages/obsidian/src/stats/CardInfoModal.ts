import type { App } from 'obsidian'
import type { CardInfo } from '../adapters/EngineReviewController'
import { Modal } from 'obsidian'
import './CardInfoModal.css'

export class CardInfoModal extends Modal {
	constructor(
		app: App,
		private info: CardInfo,
	) {
		super(app)
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		contentEl.addClass('ir-card-info-modal')
		contentEl.createEl('h2', { text: 'Card Info' })

		const info = this.info

		const section = contentEl.createDiv('ir-card-info-section')

		// Basic info
		section.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Type:</span> <span>${info.type}</span>`
		section.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Status:</span> <span>${info.status}</span>`
		section.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Priority:</span> <span>${info.priority}</span>`

		// Scheduling info
		const scheduleSection = contentEl.createDiv('ir-card-info-section')
		scheduleSection.createEl('h3', { text: 'Scheduling' })

		const dueText = info.due ? this.formatDate(info.due) : 'Not scheduled'
		scheduleSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Due:</span> <span>${dueText}</span>`

		const lastReviewText = info.lastReview ? this.formatDate(info.lastReview) : 'Never'
		scheduleSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Last review:</span> <span>${lastReviewText}</span>`

		scheduleSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Reviews:</span> <span>${info.reps}</span>`
		scheduleSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Lapses:</span> <span>${info.lapses}</span>`

		// FSRS parameters
		const fsrsSection = contentEl.createDiv('ir-card-info-section')
		fsrsSection.createEl('h3', { text: 'FSRS Parameters' })

		fsrsSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Stability:</span> <span>${info.stability.toFixed(2)} days</span>`
		fsrsSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Difficulty:</span> <span>${info.difficulty.toFixed(2)}</span>`

		// File info
		const fileSection = contentEl.createDiv('ir-card-info-section')
		fileSection.createEl('h3', { text: 'File' })

		fileSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">Path:</span> <span class="ir-card-info-path">${info.notePath}</span>`
		fileSection.createEl('div', { cls: 'ir-card-info-row' }).innerHTML =
			`<span class="ir-card-info-label">ID:</span> <span class="ir-card-info-id">${info.id}</span>`
	}

	onClose(): void {
		this.contentEl.empty()
	}

	private formatDate(date: Date): string {
		const now = new Date()
		const diff = date.getTime() - now.getTime()
		const days = Math.round(diff / (1000 * 60 * 60 * 24))

		const dateStr = date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})

		if (days === 0) {
			return `${dateStr} (today)`
		} else if (days === 1) {
			return `${dateStr} (tomorrow)`
		} else if (days === -1) {
			return `${dateStr} (yesterday)`
		} else if (days > 0) {
			return `${dateStr} (in ${days} days)`
		} else {
			return `${dateStr} (${Math.abs(days)} days ago)`
		}
	}
}
