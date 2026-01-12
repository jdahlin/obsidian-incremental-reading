import type { ItemState, ItemWithState, ReviewRecord } from '@repo/core/core/types'
import type { Rating, ReviewState, Status } from '@repo/core/types'
import type { ServerDeps } from '../server'

import {
	buildForecastData,
	buildHeatmapData,
	calculateAnswerDistribution,
	calculateRetention,
	calculateStreak,
} from '@repo/core/stats'
import { Hono } from 'hono'

/**
 * Convert ReviewState to ItemState for compatibility.
 */
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

export function createStatsRoutes(deps: ServerDeps): Hono {
	const app = new Hono()

	/**
	 * GET /api/stats
	 * Returns review statistics.
	 */
	app.get('/', async (c) => {
		const items = await deps.dataStore.listItems()

		// Get states for all items
		const states = await Promise.all(
			items.map(async (item) => {
				const state = await deps.dataStore.getState(item.id)
				return { item, state }
			}),
		)

		// Count items by status
		const counts = {
			total: items.length,
			new: 0,
			learning: 0,
			review: 0,
			relearning: 0,
		}

		for (const { state } of states) {
			if (state === null) {
				counts.new++
			} else {
				counts[state.status]++
			}
		}

		// Get due counts
		const now = new Date()
		let dueCount = 0
		for (const { state } of states) {
			if (state === null) {
				dueCount++ // new items are always due
			} else if (state.due === null || state.due <= now) {
				dueCount++
			}
		}

		return c.json({
			counts,
			dueCount,
		})
	})

	/**
	 * GET /api/stats/heatmap
	 * Returns heatmap data for the calendar view.
	 */
	app.get('/heatmap', async (c) => {
		const daysParam = c.req.query('days')
		const days = daysParam !== undefined ? Number.parseInt(daysParam, 10) : 90

		// Read revlog files to get review history
		const reviews = await readRevlogFiles(deps.fs)
		const heatmapData = buildHeatmapData(reviews, days)

		return c.json({ data: heatmapData })
	})

	/**
	 * GET /api/stats/forecast
	 * Returns forecast data for future reviews.
	 */
	app.get('/forecast', async (c) => {
		const daysParam = c.req.query('days')
		const days = daysParam !== undefined ? Number.parseInt(daysParam, 10) : 30

		const items = await deps.dataStore.listItems()
		const now = new Date()

		// Build ItemWithState array for forecast
		const itemsWithState: ItemWithState[] = []
		for (const item of items) {
			const state = await deps.dataStore.getState(item.id)
			itemsWithState.push({
				id: item.id,
				noteId: item.noteId,
				notePath: item.notePath,
				type: item.type === 'cloze' ? 'item' : item.type,
				clozeIndex: 'clozeIndex' in item ? item.clozeIndex : null,
				state: toItemState(state),
				priority: item.priority,
				created: item.created ?? new Date(),
			})
		}

		const forecastData = buildForecastData(itemsWithState, days, now)

		return c.json({ data: forecastData })
	})

	/**
	 * GET /api/stats/retention
	 * Returns retention statistics.
	 */
	app.get('/retention', async (c) => {
		const reviews = await readRevlogFiles(deps.fs)
		const retention = calculateRetention(reviews)

		return c.json({ retention })
	})

	/**
	 * GET /api/stats/streak
	 * Returns current study streak.
	 */
	app.get('/streak', async (c) => {
		const reviews = await readRevlogFiles(deps.fs)
		// Convert to Date array for calculateStreak
		const reviewDates = reviews.map((r) => new Date(r.ts))
		const streak = calculateStreak(reviewDates)

		return c.json({ streak })
	})

	/**
	 * GET /api/stats/distribution
	 * Returns answer distribution.
	 */
	app.get('/distribution', async (c) => {
		const reviews = await readRevlogFiles(deps.fs)
		const distribution = calculateAnswerDistribution(reviews)

		return c.json({ distribution })
	})

	return app
}

async function readRevlogFiles(fs: {
	list: () => Promise<string[]>
	read: (path: string) => Promise<string | null>
}): Promise<ReviewRecord[]> {
	const files = await fs.list()
	const revlogFiles = files.filter((f) => f.startsWith('IR/Revlog/') && f.endsWith('.md'))

	const reviews: ReviewRecord[] = []

	for (const path of revlogFiles) {
		const content = await fs.read(path)
		if (content === null) continue

		// Parse JSONL format
		const lines = content.split('\n').filter((line) => line.trim() !== '')
		for (const line of lines) {
			try {
				const entry = JSON.parse(line) as {
					ts?: string
					item_id?: string
					rating?: number
					elapsed_ms?: number
					state_before?: Status
					stability_before?: number
					difficulty_before?: number
				}
				if (
					entry.ts !== undefined &&
					entry.item_id !== undefined &&
					entry.rating !== undefined
				) {
					reviews.push({
						ts: entry.ts,
						item_id: entry.item_id,
						rating: entry.rating as Rating,
						elapsed_ms: entry.elapsed_ms,
						state_before: entry.state_before,
						stability_before: entry.stability_before,
						difficulty_before: entry.difficulty_before,
					})
				}
			} catch {
				// Skip invalid lines
			}
		}
	}

	return reviews
}
