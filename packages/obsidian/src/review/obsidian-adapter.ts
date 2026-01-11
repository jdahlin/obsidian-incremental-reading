import type {
	DeckInfo,
	ReviewItem,
	ReviewPlatformAdapter,
	StreakInfo,
	TodayStats,
} from '@repo/core/core/types'
import type { App, TAbstractFile } from 'obsidian'
import type { SessionStateData } from '../data/session'
import { getStreakInfo, getTodayStats } from '../data/review-stats'
import { writeSessionState } from '../data/session'
import { loadReviewItemHtml } from '../review/content'
import { StatsModal } from '../stats/StatsModal'

export class ObsidianReviewAdapter implements ReviewPlatformAdapter {
	constructor(
		private app: App,
		private view: unknown,
	) {}

	async getTodayStats(now: Date): Promise<TodayStats> {
		return getTodayStats(this.app, now)
	}

	async getStreakInfo(now: Date): Promise<StreakInfo> {
		return getStreakInfo(this.app, now)
	}

	async renderItem(
		item: ReviewItem,
		phase: 'question' | 'answer',
		extractTag: string,
	): Promise<string> {
		return loadReviewItemHtml({ app: this.app, view: this.view, extractTag }, item, phase)
	}

	openStats(extractTag: string): void {
		new StatsModal(this.app, extractTag).open()
	}

	getPreselectedPath(decks: DeckInfo[]): string | null {
		const active = this.app.workspace.getActiveFile()
		if (!active) return null
		let folder = active.parent?.path ?? ''
		if (!folder) return null
		const deckPaths = this.collectDeckPaths(decks)
		while (folder) {
			if (deckPaths.has(folder)) return folder
			const parts = folder.split('/')
			parts.pop()
			folder = parts.join('/')
		}
		return null
	}

	onDataChange(handler: () => void): () => void {
		const { vault } = this.app
		const refresh = (file: TAbstractFile) => {
			if (file.path?.startsWith('IR/Review Items/')) {
				handler()
			}
		}

		const refs = [
			vault.on('create', refresh),
			vault.on('delete', refresh),
			vault.on('modify', refresh),
		]

		return () => {
			refs.forEach((ref) => vault.offref(ref))
		}
	}

	async updateSessionState(data: SessionStateData): Promise<void> {
		await writeSessionState(this.app, data)
	}

	private collectDeckPaths(decks: DeckInfo[]): Set<string> {
		const paths = new Set<string>()
		const walk = (nodes: DeckInfo[]): void => {
			for (const node of nodes) {
				paths.add(node.path)
				if (node.children.length) walk(node.children)
			}
		}
		walk(decks)
		return paths
	}
}
