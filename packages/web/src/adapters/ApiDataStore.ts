import type { DataStore, ReviewItem, ReviewRecord, ReviewState } from '@repo/core/types'

import type { ApiClient, QueueItem } from './ApiClient'

/**
 * API-backed DataStore implementation.
 * Uses the REST API to read/write data.
 */
export class ApiDataStore implements DataStore {
	private itemsCache: Map<string, ReviewItem> | null = null

	constructor(private api: ApiClient) {}

	async listItems(): Promise<ReviewItem[]> {
		// Get items from the API queue endpoint
		const response = await this.api.getQueue({ limit: 10000 })
		return response.items.map((item) => this.mapQueueItem(item))
	}

	async getState(itemId: string): Promise<ReviewState | null> {
		try {
			const item = await this.api.getItem(itemId)
			if (item.state === null) {
				return null
			}
			return {
				status: item.state.status as ReviewState['status'],
				due: item.state.due !== null ? new Date(item.state.due) : null,
				stability: item.state.stability,
				difficulty: item.state.difficulty,
				reps: item.state.reps,
				lapses: item.state.lapses,
				lastReview: null, // API doesn't return this currently
			}
		} catch {
			return null
		}
	}

	async setState(itemId: string, state: ReviewState): Promise<void> {
		// State is set implicitly through reviews
		// This is a no-op for the API backend as state is managed server-side
		console.warn('setState called on ApiDataStore - state is managed by API', {
			itemId,
			state,
		})
	}

	async appendReview(record: ReviewRecord): Promise<void> {
		// Reviews are submitted through the review endpoint
		await this.api.submitReview(record.itemId, record.rating, record.elapsedMs)
	}

	async setScrollPos(itemId: string, pos: number): Promise<void> {
		await this.api.setScrollPos(itemId, pos)
	}

	async getScrollPos(itemId: string): Promise<number | null> {
		const result = await this.api.getScrollPos(itemId)
		return result.pos
	}

	/**
	 * Invalidate the items cache.
	 */
	invalidateCache(): void {
		this.itemsCache = null
	}

	private mapQueueItem(item: QueueItem): ReviewItem {
		const base = {
			id: item.id,
			noteId: item.noteId,
			notePath: item.notePath,
			priority: item.priority,
			created: null,
		}

		if (item.type === 'cloze' || item.type === 'item') {
			return {
				...base,
				type: 'cloze',
				clozeIndex: item.clozeIndex ?? 1,
			}
		}

		if (item.type === 'image_occlusion') {
			return {
				...base,
				type: 'image_occlusion',
				clozeIndex: item.clozeIndex ?? 1,
			}
		}

		if (item.type === 'basic') {
			return {
				...base,
				type: 'basic',
			}
		}

		// Default to topic
		return {
			...base,
			type: 'topic',
		}
	}
}
