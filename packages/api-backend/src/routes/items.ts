import type { Rating, ReviewState } from '@repo/core/types'
import type { ServerDeps } from '../server'

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const reviewSchema = z.object({
	rating: z.number().min(1).max(4),
	elapsedMs: z.number().optional(),
})

export function createItemsRoutes(deps: ServerDeps): Hono {
	const app = new Hono()

	/**
	 * GET /api/items/:id
	 * Returns item metadata and state.
	 */
	app.get('/:id', async (c) => {
		const id = c.req.param('id')
		const items = await deps.dataStore.listItems()
		const item = items.find((i) => i.id === id)

		if (item === undefined) {
			return c.json({ error: 'Item not found' }, 404)
		}

		const state = await deps.dataStore.getState(id)

		return c.json({
			id: item.id,
			noteId: item.noteId,
			notePath: item.notePath,
			type: item.type,
			clozeIndex: 'clozeIndex' in item ? item.clozeIndex : null,
			priority: item.priority,
			state: state
				? {
						status: state.status,
						due: state.due?.toISOString() ?? null,
						stability: state.stability,
						difficulty: state.difficulty,
						reps: state.reps,
						lapses: state.lapses,
					}
				: null,
		})
	})

	/**
	 * GET /api/items/:id/content
	 * Returns the note content for an item.
	 */
	app.get('/:id/content', async (c) => {
		const id = c.req.param('id')
		const items = await deps.dataStore.listItems()
		const item = items.find((i) => i.id === id)

		if (item === undefined) {
			return c.json({ error: 'Item not found' }, 404)
		}

		const content = await deps.notePlatform.getNote(item.notePath)

		if (content === null) {
			return c.json({ error: 'Note content not found' }, 404)
		}

		return c.json({
			id: item.id,
			notePath: item.notePath,
			content,
			type: item.type,
			clozeIndex: 'clozeIndex' in item ? item.clozeIndex : null,
		})
	})

	/**
	 * POST /api/items/:id/review
	 * Submit a review for an item.
	 */
	app.post('/:id/review', zValidator('json', reviewSchema), async (c) => {
		const id = c.req.param('id')
		const body = c.req.valid('json')

		const items = await deps.dataStore.listItems()
		const item = items.find((i) => i.id === id)

		if (item === undefined) {
			return c.json({ error: 'Item not found' }, 404)
		}

		const currentState = await deps.dataStore.getState(id)
		const now = new Date()

		// Import scheduler and grade the review
		const { FSRSScheduler } = await import('@repo/core/scheduling')
		const scheduler = new FSRSScheduler({})

		const state: ReviewState = currentState ?? {
			status: 'new',
			due: null,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
		}

		const rating = body.rating as Rating
		const newState = scheduler.grade(state, rating, now)

		// Save the new state
		await deps.dataStore.setState(id, newState)

		// Append review record
		await deps.dataStore.appendReview({
			ts: now.toISOString(),
			itemId: id,
			rating,
			elapsedMs: body.elapsedMs,
			stateBefore: state.status,
			stabilityBefore: state.stability,
			difficultyBefore: state.difficulty,
		})

		return c.json({
			success: true,
			newState: {
				status: newState.status,
				due: newState.due?.toISOString() ?? null,
				stability: newState.stability,
				difficulty: newState.difficulty,
				reps: newState.reps,
				lapses: newState.lapses,
			},
		})
	})

	/**
	 * PUT /api/items/:id/scroll
	 * Update scroll position for an item.
	 */
	app.put('/:id/scroll', zValidator('json', z.object({ pos: z.number() })), async (c) => {
		const id = c.req.param('id')
		const { pos } = c.req.valid('json')

		await deps.dataStore.setScrollPos(id, pos)

		return c.json({ success: true })
	})

	/**
	 * GET /api/items/:id/scroll
	 * Get scroll position for an item.
	 */
	app.get('/:id/scroll', async (c) => {
		const id = c.req.param('id')
		const pos = await deps.dataStore.getScrollPos(id)

		return c.json({ pos })
	})

	return app
}
