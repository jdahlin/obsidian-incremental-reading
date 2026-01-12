import type { DeckInfo, StreakInfo, TodayStats } from '@repo/core/core/types'
import type {
	CardInfo,
	ContentRenderInfo,
	ReviewPlatform,
	SessionStateData,
} from '@repo/core/review'

import type { ApiClient, DeckData } from './ApiClient'

import { formatReviewContent } from '@repo/core/core/content'

const STORAGE_KEY_SESSION = 'ir-session-api'

/**
 * API-backed ReviewPlatform implementation.
 */
export class ApiReviewPlatform implements ReviewPlatform {
	private onCardInfoCallback: ((info: CardInfo) => void) | null = null
	private todayStats: TodayStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }

	constructor(private api: ApiClient) {}

	async getContent(info: ContentRenderInfo, _extractTag: string): Promise<string> {
		try {
			const response = await this.api.getItemContent(info.noteId)
			const markdown = response.content

			// Format the content based on type and phase
			const formatted = formatReviewContent(markdown, info.type, info.phase, info.clozeIndex)
			return this.renderMarkdown(formatted)
		} catch (err) {
			console.error('Failed to get content:', err)
			return '<p class="ir-error">Failed to load content</p>'
		}
	}

	async getTodayStats(_now: Date): Promise<TodayStats> {
		return this.todayStats
	}

	async getStreakInfo(_now: Date): Promise<StreakInfo> {
		try {
			const response = await this.api.getStreak()
			return response.streak
		} catch {
			return { current: 0, longest: 0 }
		}
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DeckInfo type
	getPreselectedPath(_decks: readonly DeckInfo[]): string | null {
		// Could read from URL params or localStorage
		return null
	}

	onDataChange(_callback: () => void): () => void {
		// No external data changes in web version
		return () => {}
	}

	async updateSessionFile(data: SessionStateData): Promise<void> {
		localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(data))

		// Track today's stats locally
		if (data.session !== null) {
			this.todayStats = {
				reviewed: data.session.reviewed,
				again: data.session.again,
				hard: data.session.hard,
				good: data.session.good,
				easy: data.session.easy,
			}
		}
	}

	async openNote(_notePath: string): Promise<void> {
		// Could open in a modal or new tab
	}

	async deleteItem(_noteId: string, _clozeKey?: string): Promise<void> {
		// Deletion not supported in web version yet
	}

	showCardInfo(info: CardInfo): void {
		if (this.onCardInfoCallback !== null) {
			this.onCardInfoCallback(info)
		}
	}

	openStats(_extractTag: string): void {
		// Could open a stats modal
	}

	/**
	 * Set the callback for showing card info.
	 */
	setOnCardInfo(callback: (info: CardInfo) => void): void {
		this.onCardInfoCallback = callback
	}

	/**
	 * Get decks from the API and convert to DeckInfo.
	 */
	async getDecks(): Promise<{ decks: DeckInfo[]; allCounts: DeckInfo['counts'] }> {
		const response = await this.api.getFolders()
		return {
			decks: response.decks.map((d) => this.mapDeck(d)),
			allCounts: response.allCounts,
		}
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- API type
	private mapDeck(deck: DeckData): DeckInfo {
		return {
			path: deck.path,
			name: deck.name,
			depth: deck.depth,
			counts: deck.counts,
			collapsed: deck.collapsed,
			children: deck.children.map((c) => this.mapDeck(c)),
		}
	}

	/**
	 * Simple markdown to HTML renderer.
	 */
	private renderMarkdown(markdown: string): string {
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
