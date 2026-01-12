/**
 * API client for communicating with the backend server.
 */
export class ApiClient {
	constructor(private baseUrl: string = 'http://localhost:3001') {}

	/**
	 * Get the review queue.
	 */
	async getQueue(options?: { folder?: string; limit?: number }): Promise<QueueResponse> {
		const params = new URLSearchParams()
		if (options?.folder !== undefined) {
			params.set('folder', options.folder)
		}
		if (options?.limit !== undefined) {
			params.set('limit', String(options.limit))
		}
		const url = `${this.baseUrl}/api/queue?${params.toString()}`
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to get queue: ${response.statusText}`)
		}
		return response.json() as Promise<QueueResponse>
	}

	/**
	 * Get folder/deck information.
	 */
	async getFolders(): Promise<FoldersResponse> {
		const response = await fetch(`${this.baseUrl}/api/queue/folders`)
		if (!response.ok) {
			throw new Error(`Failed to get folders: ${response.statusText}`)
		}
		return response.json() as Promise<FoldersResponse>
	}

	/**
	 * Get item metadata and state.
	 */
	async getItem(id: string): Promise<ItemResponse> {
		const response = await fetch(`${this.baseUrl}/api/items/${encodeURIComponent(id)}`)
		if (!response.ok) {
			throw new Error(`Failed to get item: ${response.statusText}`)
		}
		return response.json() as Promise<ItemResponse>
	}

	/**
	 * Get item content.
	 */
	async getItemContent(id: string): Promise<ItemContentResponse> {
		const response = await fetch(`${this.baseUrl}/api/items/${encodeURIComponent(id)}/content`)
		if (!response.ok) {
			throw new Error(`Failed to get item content: ${response.statusText}`)
		}
		return response.json() as Promise<ItemContentResponse>
	}

	/**
	 * Submit a review for an item.
	 */
	async submitReview(id: string, rating: number, elapsedMs?: number): Promise<ReviewResponse> {
		const response = await fetch(`${this.baseUrl}/api/items/${encodeURIComponent(id)}/review`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rating, elapsedMs }),
		})
		if (!response.ok) {
			throw new Error(`Failed to submit review: ${response.statusText}`)
		}
		return response.json() as Promise<ReviewResponse>
	}

	/**
	 * Get scroll position for an item.
	 */
	async getScrollPos(id: string): Promise<{ pos: number | null }> {
		const response = await fetch(`${this.baseUrl}/api/items/${encodeURIComponent(id)}/scroll`)
		if (!response.ok) {
			throw new Error(`Failed to get scroll position: ${response.statusText}`)
		}
		return response.json() as Promise<{ pos: number | null }>
	}

	/**
	 * Set scroll position for an item.
	 */
	async setScrollPos(id: string, pos: number): Promise<void> {
		const response = await fetch(`${this.baseUrl}/api/items/${encodeURIComponent(id)}/scroll`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ pos }),
		})
		if (!response.ok) {
			throw new Error(`Failed to set scroll position: ${response.statusText}`)
		}
	}

	/**
	 * Get statistics.
	 */
	async getStats(): Promise<StatsResponse> {
		const response = await fetch(`${this.baseUrl}/api/stats`)
		if (!response.ok) {
			throw new Error(`Failed to get stats: ${response.statusText}`)
		}
		return response.json() as Promise<StatsResponse>
	}

	/**
	 * Get streak information.
	 */
	async getStreak(): Promise<StreakResponse> {
		const response = await fetch(`${this.baseUrl}/api/stats/streak`)
		if (!response.ok) {
			throw new Error(`Failed to get streak: ${response.statusText}`)
		}
		return response.json() as Promise<StreakResponse>
	}

	/**
	 * Get media URL.
	 */
	getMediaUrl(path: string): string {
		return `${this.baseUrl}/api/media/${encodeURIComponent(path)}`
	}
}

export interface QueueItem {
	id: string
	noteId: string
	notePath: string
	type: string
	clozeIndex: number | null
	priority: number
	state: {
		status: string
		due: string | null
		stability: number
		difficulty: number
		reps: number
		lapses: number
	}
}

export interface QueueResponse {
	items: QueueItem[]
	total: number
}

export interface FoldersResponse {
	decks: DeckData[]
	allCounts: {
		new: number
		learning: number
		due: number
	}
}

export interface DeckData {
	path: string
	name: string
	depth: number
	counts: {
		new: number
		learning: number
		due: number
	}
	collapsed: boolean
	children: DeckData[]
}

export interface ItemResponse {
	id: string
	noteId: string
	notePath: string
	type: string
	clozeIndex: number | null
	priority: number
	state: {
		status: string
		due: string | null
		stability: number
		difficulty: number
		reps: number
		lapses: number
	} | null
}

export interface ItemContentResponse {
	id: string
	notePath: string
	content: string
	type: string
	clozeIndex: number | null
}

export interface ReviewResponse {
	success: boolean
	newState: {
		status: string
		due: string | null
		stability: number
		difficulty: number
		reps: number
		lapses: number
	}
}

export interface StatsResponse {
	counts: {
		total: number
		new: number
		learning: number
		review: number
		relearning: number
	}
	dueCount: number
}

export interface StreakResponse {
	streak: {
		current: number
		longest: number
	}
}
