import type { DataStore, NotePlatform } from '@repo/core/types'
import type { CachingDataStore } from './data/CachingDataStore'
import type { NodeFileSystem } from './fs/NodeFileSystem'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { createItemsRoutes } from './routes/items'
import { createMediaRoutes } from './routes/media'
import { createQueueRoutes } from './routes/queue'
import { createStatsRoutes } from './routes/stats'

export interface ServerDeps {
	fs: NodeFileSystem
	dataStore: DataStore
	cachingDataStore?: CachingDataStore
	notePlatform: NotePlatform
}

// eslint-disable-next-line ts/prefer-readonly-parameter-types -- Hono deps
export function createServer(deps: ServerDeps): Hono {
	const app = new Hono()

	// Middleware
	app.use('*', logger())
	app.use(
		'*',
		cors({
			origin: ['http://localhost:3000', 'http://localhost:5173'],
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
			allowHeaders: ['Content-Type'],
		}),
	)

	// Health check
	app.get('/health', (c) => c.json({ status: 'ok' }))

	// API routes
	app.route('/api/queue', createQueueRoutes(deps))
	app.route('/api/items', createItemsRoutes(deps))
	app.route('/api/stats', createStatsRoutes(deps))
	app.route('/api/media', createMediaRoutes(deps))

	return app
}
