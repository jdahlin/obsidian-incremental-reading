import type { DataStore, ReviewItem, ReviewRecord, ReviewState } from '@repo/core/types'

const STORAGE_KEY_ITEMS = 'ir-items'
const STORAGE_KEY_STATES = 'ir-states'
const STORAGE_KEY_REVIEWS = 'ir-reviews'
const STORAGE_KEY_SCROLL = 'ir-scroll'

/**
 * Web-based DataStore implementation using localStorage.
 */
export class WebDataStore implements DataStore {
	private items: Map<string, ReviewItem> = new Map()
	private states: Map<string, ReviewState> = new Map()
	private scrollPositions: Map<string, number> = new Map()

	constructor() {
		this.loadFromStorage()
	}

	async listItems(): Promise<ReviewItem[]> {
		return Array.from(this.items.values())
	}

	async getState(itemId: string): Promise<ReviewState | null> {
		return this.states.get(itemId) ?? null
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- state object
	async setState(itemId: string, state: ReviewState): Promise<void> {
		this.states.set(itemId, state)
		this.saveStates()
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- record object
	async appendReview(record: ReviewRecord): Promise<void> {
		const reviews = this.loadReviews()
		reviews.push(record)
		localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(reviews))
	}

	async setScrollPos(itemId: string, pos: number): Promise<void> {
		this.scrollPositions.set(itemId, pos)
		this.saveScrollPositions()
	}

	async getScrollPos(itemId: string): Promise<number | null> {
		return this.scrollPositions.get(itemId) ?? null
	}

	/**
	 * Add an item to the store.
	 */
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- item object
	addItem(item: ReviewItem): void {
		this.items.set(item.id, item)
		this.saveItems()
	}

	/**
	 * Remove an item from the store.
	 */
	removeItem(itemId: string): void {
		this.items.delete(itemId)
		this.states.delete(itemId)
		this.saveItems()
		this.saveStates()
	}

	/**
	 * Clear all data.
	 */
	clear(): void {
		this.items.clear()
		this.states.clear()
		this.scrollPositions.clear()
		localStorage.removeItem(STORAGE_KEY_ITEMS)
		localStorage.removeItem(STORAGE_KEY_STATES)
		localStorage.removeItem(STORAGE_KEY_REVIEWS)
		localStorage.removeItem(STORAGE_KEY_SCROLL)
	}

	/**
	 * Import items from JSON data.
	 */
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- item array
	importItems(items: ReviewItem[]): void {
		for (const item of items) {
			this.items.set(item.id, item)
		}
		this.saveItems()
	}

	private loadFromStorage(): void {
		try {
			const itemsJson = localStorage.getItem(STORAGE_KEY_ITEMS)
			if (itemsJson !== null) {
				const items = JSON.parse(itemsJson) as ReviewItem[]
				for (const item of items) {
					// Restore Date objects
					if (item.created !== undefined && item.created !== null) {
						item.created = new Date(item.created)
					}
					this.items.set(item.id, item)
				}
			}

			const statesJson = localStorage.getItem(STORAGE_KEY_STATES)
			if (statesJson !== null) {
				const states = JSON.parse(statesJson) as Record<string, ReviewState>
				for (const [id, state] of Object.entries(states)) {
					// Restore Date objects
					if (state.due !== null) {
						state.due = new Date(state.due)
					}
					if (state.lastReview !== null) {
						state.lastReview = new Date(state.lastReview)
					}
					this.states.set(id, state)
				}
			}

			const scrollJson = localStorage.getItem(STORAGE_KEY_SCROLL)
			if (scrollJson !== null) {
				const positions = JSON.parse(scrollJson) as Record<string, number>
				for (const [id, pos] of Object.entries(positions)) {
					this.scrollPositions.set(id, pos)
				}
			}
		} catch (err) {
			console.error('Failed to load from localStorage:', err)
		}
	}

	private saveItems(): void {
		const items = Array.from(this.items.values())
		localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items))
	}

	private saveStates(): void {
		const states: Record<string, ReviewState> = {}
		for (const [id, state] of this.states) {
			states[id] = state
		}
		localStorage.setItem(STORAGE_KEY_STATES, JSON.stringify(states))
	}

	private saveScrollPositions(): void {
		const positions: Record<string, number> = {}
		for (const [id, pos] of this.scrollPositions) {
			positions[id] = pos
		}
		localStorage.setItem(STORAGE_KEY_SCROLL, JSON.stringify(positions))
	}

	private loadReviews(): ReviewRecord[] {
		try {
			const json = localStorage.getItem(STORAGE_KEY_REVIEWS)
			return json !== null ? (JSON.parse(json) as ReviewRecord[]) : []
		} catch {
			return []
		}
	}
}
