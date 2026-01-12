import type { DeepReadonly } from '@repo/core/core/readonly'
import type {
	DeckInfo,
	ItemWithState,
	ReviewPlatformAdapter,
	StreakInfo,
	TodayStats,
} from '@repo/core/core/types'
import type { CardInfo, SessionStateData } from '@repo/core/review'
import type { App, TAbstractFile } from 'obsidian'
import { TFile } from 'obsidian'
import { deleteReviewItemFile, readReviewItemFile, writeReviewItemFile } from '../data/review-items'
import { getStreakInfo, getTodayStats } from '../data/review-stats'
import { writeSessionState } from '../data/session'
import { loadReviewItemHtml } from '../review/content'
import { CardInfoModal } from '../stats/CardInfoModal'
import { VIEW_TYPE_STATS } from '../stats/StatsView'

/**
 * Obsidian-specific implementation of ReviewPlatformAdapter.
 * Adapts core review operations to Obsidian's APIs.
 */
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
		item: DeepReadonly<ItemWithState>,
		phase: 'question' | 'answer',
		extractTag: string,
	): Promise<string> {
		return loadReviewItemHtml({ app: this.app, view: this.view, extractTag }, item, phase)
	}

	openStats(_extractTag: string): void {
		const { workspace } = this.app
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STATS)[0]
		if (!leaf) {
			const mostRecent = workspace.getMostRecentLeaf()
			if (!mostRecent) return
			leaf = mostRecent
			void leaf.setViewState({ type: VIEW_TYPE_STATS, active: true })
		}
		void workspace.revealLeaf(leaf)
		workspace.setActiveLeaf(leaf, { focus: true })
	}

	getPreselectedPath(decks: readonly DeepReadonly<DeckInfo>[]): string | null {
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
		const refresh = (file: DeepReadonly<TAbstractFile>) => {
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

	async updateSessionState(data: DeepReadonly<SessionStateData>): Promise<void> {
		await writeSessionState(this.app, data)
	}

	async openNote(notePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath)
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf('tab').openFile(file)
		}
	}

	async deleteItem(noteId: string, clozeKey?: string): Promise<void> {
		if (clozeKey !== undefined && clozeKey !== '') {
			// Delete only the specific cloze entry
			const data = await readReviewItemFile(this.app, noteId)
			if (data?.clozes && data.clozes[clozeKey]) {
				delete data.clozes[clozeKey]
				// If no more clozes and no topic, delete the whole file
				if (Object.keys(data.clozes).length === 0 && !data.topic) {
					await deleteReviewItemFile(this.app, noteId)
				} else {
					await writeReviewItemFile(this.app, noteId, data)
				}
			}
		} else {
			// Delete the entire review item file
			await deleteReviewItemFile(this.app, noteId)
		}
	}

	showCardInfo(info: DeepReadonly<CardInfo>): void {
		new CardInfoModal(this.app, info).open()
	}

	private collectDeckPaths(decks: readonly DeepReadonly<DeckInfo>[]): Set<string> {
		const paths = new Set<string>()
		const walk = (nodes: readonly DeepReadonly<DeckInfo>[]): void => {
			for (const node of nodes) {
				paths.add(node.path)
				if (node.children.length > 0) walk(node.children)
			}
		}
		walk(decks)
		return paths
	}
}
