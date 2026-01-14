import type { DeckInfo, StreakInfo, TodayStats } from '@repo/core/core/types'
import type {
	CardInfo,
	ContentRenderInfo,
	ReviewPlatform,
	SessionStateData,
} from '@repo/core/review'

import type { WebNotePlatform } from './WebNotePlatform'

import { formatReviewContent } from '@repo/core/core/content'

const STORAGE_KEY_STATS = 'ir-today-stats'
const STORAGE_KEY_SESSION = 'ir-session'

/**
 * Web-based ReviewPlatform implementation.
 */
export class WebReviewPlatform implements ReviewPlatform {
	private onCardInfoCallback: ((info: CardInfo) => void) | null = null

	constructor(private notePlatform: WebNotePlatform) {}

	async getContent(info: ContentRenderInfo, _extractTag: string): Promise<string> {
		const markdown = await this.notePlatform.getNote(info.noteId)
		if (markdown === null) {
			return '<p class="ir-error">Note not found</p>'
		}

		// Format the content based on type and phase
		const formatted = formatReviewContent(markdown, info.type, info.phase, info.clozeIndex)
		return this.renderMarkdown(formatted)
	}

	async getTodayStats(_now: Date): Promise<TodayStats> {
		try {
			const json = localStorage.getItem(STORAGE_KEY_STATS)
			if (json !== null) {
				const data = JSON.parse(json) as { date: string; stats: TodayStats }
				const today = new Date().toDateString()
				if (data.date === today) {
					return data.stats
				}
			}
		} catch {
			// Ignore
		}
		return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }
	}

	async getStreakInfo(_now: Date): Promise<StreakInfo> {
		// Web version doesn't track streaks yet
		return { current: 0, longest: 0 }
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DeckInfo type
	getPreselectedPath(_decks: readonly DeckInfo[]): string | null {
		// No preselection for web
		return null
	}

	onDataChange(_callback: () => void): () => void {
		// Web version uses React state, no external data changes
		return () => {}
	}

	async updateSessionFile(data: SessionStateData): Promise<void> {
		localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(data))

		// Update today's stats
		if (data.session !== null) {
			const today = new Date().toDateString()
			const statsData = {
				date: today,
				stats: {
					reviewed: data.session.reviewed,
					again: data.session.again,
					hard: data.session.hard,
					good: data.session.good,
					easy: data.session.easy,
				},
			}
			localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(statsData))
		}
	}

	async openNote(_notePath: string): Promise<void> {
		// Web version could open in a modal or new tab - not implemented yet
	}

	async deleteItem(_noteId: string, _clozeKey?: string): Promise<void> {
		// Deletion would need to update the data store - not implemented yet
	}

	showCardInfo(info: CardInfo): void {
		if (this.onCardInfoCallback !== null) {
			this.onCardInfoCallback(info)
		}
	}

	openStats(_extractTag: string): void {
		// Web version could open a stats modal - not implemented yet
	}

	/**
	 * Set the callback for showing card info.
	 */
	setOnCardInfo(callback: (info: CardInfo) => void): void {
		this.onCardInfoCallback = callback
	}

	/**
	 * Simple markdown to HTML renderer.
	 * In production, use a proper markdown parser like marked.
	 */
	private renderMarkdown(markdown: string): string {
		// Very basic markdown rendering
		let html = markdown
			// Headers
			.replace(/^### (.+)$/gm, '<h3>$1</h3>')
			.replace(/^## (.+)$/gm, '<h2>$1</h2>')
			.replace(/^# (.+)$/gm, '<h1>$1</h1>')
			// Bold
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			// Italic
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			// Code blocks
			.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
			// Inline code
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			// Line breaks
			.replace(/\n/g, '<br>')

		// Wrap in paragraph if no block elements
		if (!html.startsWith('<h') && !html.startsWith('<pre')) {
			html = `<p>${html}</p>`
		}

		return html
	}
}
