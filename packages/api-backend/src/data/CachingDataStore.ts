/* eslint-disable no-console -- Logging cache initialization status */
import type { DataStore, ReviewItem, ReviewRecord, ReviewState } from '@repo/core/types'

/**
 * Caching wrapper around a DataStore.
 * Loads all items and states into memory on first access for fast lookups.
 */
export class CachingDataStore implements DataStore {
	private items: ReviewItem[] | null = null
	private states: Map<string, ReviewState | null> = new Map()
	private initialized = false
	private initPromise: Promise<void> | null = null

	constructor(private delegate: DataStore) {}

	/**
	 * Initialize the cache by loading all items and states.
	 * Call this at server startup.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return
		if (this.initPromise !== null) return this.initPromise

		this.initPromise = this.doInitialize()
		await this.initPromise
	}

	private async doInitialize(): Promise<void> {
		const startTime = Date.now()

		// Load all items
		this.items = await this.delegate.listItems()

		// Load all states in parallel batches
		const batchSize = 100
		for (let i = 0; i < this.items.length; i += batchSize) {
			const batch = this.items.slice(i, i + batchSize)
			const states = await Promise.all(
				batch.map(async (item) => this.delegate.getState(item.id)),
			)
			for (let j = 0; j < batch.length; j++) {
				const item = batch[j]
				if (item !== undefined) {
					this.states.set(item.id, states[j] ?? null)
				}
			}
		}

		this.initialized = true
		const elapsed = Date.now() - startTime
		console.log(`Cache initialized: ${this.items.length} items in ${elapsed}ms`)
	}

	async listItems(): Promise<ReviewItem[]> {
		await this.initialize()
		return this.items ?? []
	}

	async getState(itemId: string): Promise<ReviewState | null> {
		await this.initialize()
		if (this.states.has(itemId)) {
			return this.states.get(itemId) ?? null
		}
		// Fallback to delegate for items not in cache
		const state = await this.delegate.getState(itemId)
		this.states.set(itemId, state)
		return state
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- ReviewState type
	async setState(itemId: string, state: ReviewState): Promise<void> {
		await this.delegate.setState(itemId, state)
		// Update cache
		this.states.set(itemId, state)
	}

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- ReviewRecord type
	async appendReview(record: ReviewRecord): Promise<void> {
		await this.delegate.appendReview(record)
	}

	async setScrollPos(itemId: string, pos: number): Promise<void> {
		await this.delegate.setScrollPos(itemId, pos)
	}

	async getScrollPos(itemId: string): Promise<number | null> {
		return this.delegate.getScrollPos(itemId)
	}

	/**
	 * Get all items with their states efficiently (no extra async calls).
	 */
	async getItemsWithStates(): Promise<Array<{ item: ReviewItem; state: ReviewState | null }>> {
		await this.initialize()
		return (this.items ?? []).map((item) => ({
			item,
			state: this.states.get(item.id) ?? null,
		}))
	}

	/**
	 * Invalidate the cache (call after external changes).
	 */
	invalidate(): void {
		this.items = null
		this.states.clear()
		this.initialized = false
		this.initPromise = null
	}
}
