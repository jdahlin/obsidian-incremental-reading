import type { DeepReadonly } from '@repo/core/core/readonly'
import type { DataStore, NotePlatform } from '@repo/core/types'
import type { CachingDataStore } from './data/CachingDataStore'
import type { NodeFileSystem } from './fs/NodeFileSystem'

import type { CalendarData } from './routes/content-scanner'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { Pool } from 'pg'
import { createContentScannerRoutes } from './routes/content-scanner'
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

export function createServer(deps: DeepReadonly<ServerDeps>): Hono {
	const app = new Hono()
	const calendarPath = resolve(process.cwd(), 'calendar.json')
	let calendarCache: CalendarData | null = null
	let calendarLoadedAt = 0
	const calendarTtlMs = 5 * 60 * 1000
	const pool = process.env.CONTENT_SCANNER_DSN
		? new Pool({ connectionString: process.env.CONTENT_SCANNER_DSN })
		: null

	// Middleware
	app.use('*', logger())
	app.use(
		'*',
		cors({
			origin: ['http://localhost:8000', 'http://localhost:5173', 'http://localhost:5174'],
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
	createContentScannerRoutes(app, {
		getCalendar: async (): Promise<CalendarData> => {
			const now = Date.now()
			if (calendarCache && now - calendarLoadedAt < calendarTtlMs) {
				return calendarCache
			}
			const data = await readFile(calendarPath, 'utf8')
			calendarCache = JSON.parse(data) as CalendarData
			calendarLoadedAt = now
			return calendarCache
		},
		getPool: () => pool,
	})

	return app
}
