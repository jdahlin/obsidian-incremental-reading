import type { DeckInfo, ItemState, ItemWithState } from '@repo/core/core/types'
import type { ReviewState } from '@repo/core/types'
import type { ServerDeps } from '../server'

import { buildDeckTree, getCountsForFolder } from '@repo/core/core/decks'
import { Hono } from 'hono'

/**
 * Convert ReviewState (camelCase lastReview) to ItemState (snake_case last_review).
 */
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- ReviewState type
function toItemState(state: ReviewState | null): ItemState {
	if (state === null) {
		return {
			status: 'new',
			due: null,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			last_review: null,
		}
	}
	return {
		status: state.status,
		due: state.due,
		stability: state.stability,
		difficulty: state.difficulty,
		reps: state.reps,
		lapses: state.lapses,
		last_review: state.lastReview,
	}
}

// eslint-disable-next-line ts/prefer-readonly-parameter-types -- Hono deps
export function createQueueRoutes(deps: ServerDeps): Hono {
	const app = new Hono()

	/**
	 * GET /api/queue
	 * Returns today's review queue.
	 */
	app.get('/', async (c) => {
		const folder = c.req.query('folder')
		const limitParam = c.req.query('limit')
		const limit = limitParam !== undefined ? Number.parseInt(limitParam, 10) : 50

		const now = new Date()
		const items = await deps.dataStore.listItems()

		// Build items with state
		const itemsWithState: ItemWithState[] = []
		for (const item of items) {
			// Filter by folder if specified
			if (folder !== undefined && !item.notePath.startsWith(folder)) {
				continue
			}

			const state = await deps.dataStore.getState(item.id)
			itemsWithState.push({
				id: item.id,
				noteId: item.noteId,
				notePath: item.notePath,
				type: mapItemType(item.type),
				clozeIndex: 'clozeIndex' in item ? item.clozeIndex : null,
				state: toItemState(state),
				priority: item.priority,
				created: item.created ?? new Date(),
			})
		}

		// Filter to due items
		const dueItems = itemsWithState.filter((item) => {
			if (item.state.status === 'new') return true
			if (item.state.due === null) return true
			return item.state.due <= now
		})

		// Sort by priority (higher first) then by due date
		dueItems.sort((a, b) => {
			// New items first
			if (a.state.status === 'new' && b.state.status !== 'new') return -1
			if (b.state.status === 'new' && a.state.status !== 'new') return 1

			// Then by priority
			if (b.priority !== a.priority) return b.priority - a.priority

			// Then by due date
			const aDue = a.state.due?.getTime() ?? 0
			const bDue = b.state.due?.getTime() ?? 0
			return aDue - bDue
		})

		const limited = dueItems.slice(0, limit)

		return c.json({
			items: limited.map((item) => ({
				id: item.id,
				noteId: item.noteId,
				notePath: item.notePath,
				type: item.type,
				clozeIndex: item.clozeIndex,
				priority: item.priority,
				state: {
					status: item.state.status,
					due: item.state.due?.toISOString() ?? null,
					stability: item.state.stability,
					difficulty: item.state.difficulty,
					reps: item.state.reps,
					lapses: item.state.lapses,
				},
			})),
			total: dueItems.length,
		})
	})

	/**
	 * GET /api/queue/folders
	 * Returns folders containing review items (for deck selection).
	 */
	app.get('/folders', async (c) => {
		const now = new Date()
		const items = await deps.dataStore.listItems()

		// Build items with state for deck tree
		const itemsWithState: ItemWithState[] = []
		for (const item of items) {
			const state = await deps.dataStore.getState(item.id)
			itemsWithState.push({
				id: item.id,
				noteId: item.noteId,
				notePath: item.notePath,
				type: mapItemType(item.type),
				clozeIndex: 'clozeIndex' in item ? item.clozeIndex : null,
				state: toItemState(state),
				priority: item.priority,
				created: item.created ?? new Date(),
			})
		}

		const decks = buildDeckTree(itemsWithState, now)
		const allCounts = getCountsForFolder(itemsWithState, '', now)

		return c.json({
			decks: serializeDecks(decks),
			allCounts,
		})
	})

	return app
}

function mapItemType(type: string): ItemWithState['type'] {
	const typeMap: Record<string, ItemWithState['type']> = {
		topic: 'topic',
		cloze: 'item',
		basic: 'basic',
		image_occlusion: 'image_occlusion',
	}
	return typeMap[type] ?? 'item'
}

// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DeckInfo type
function serializeDecks(decks: DeckInfo[]): unknown[] {
	return decks.map((deck) => ({
		path: deck.path,
		name: deck.name,
		depth: deck.depth,
		counts: deck.counts,
		collapsed: deck.collapsed,
		children: serializeDecks(deck.children),
	}))
}
