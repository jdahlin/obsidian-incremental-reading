#!/usr/bin/env node
/* eslint-disable no-console -- CLI entry point */

import { serve } from '@hono/node-server'
import { MarkdownDataStore } from '@repo/core/data/MarkdownDataStore'

import { CachingDataStore } from './data/CachingDataStore'
import { NodeFileSystem } from './fs/NodeFileSystem'
import { NodeNotePlatform } from './platforms/NodeNotePlatform'
import { createServer } from './server'

const DEFAULT_PORT = 3001

async function main(): Promise<void> {
	// Get vault path from command line argument or environment variable
	const vaultPath = process.argv[2] ?? process.env.VAULT_PATH

	if (vaultPath === undefined) {
		console.error('Usage: api-backend <vault-path>')
		console.error('  or set VAULT_PATH environment variable')
		process.exit(1)
	}

	// Resolve to absolute path
	const absolutePath = vaultPath.startsWith('/') ? vaultPath : `${process.cwd()}/${vaultPath}`

	console.log(`Starting API backend for vault: ${absolutePath}`)

	// Create dependencies
	const fs = new NodeFileSystem(absolutePath)
	const notePlatform = new NodeNotePlatform(fs)
	const baseDataStore = new MarkdownDataStore(fs, notePlatform)
	const cachingDataStore = new CachingDataStore(baseDataStore)

	// Initialize cache before starting server
	console.log('Loading vault data into cache...')
	await cachingDataStore.initialize()

	// Create and start server
	const app = createServer({ fs, dataStore: cachingDataStore, cachingDataStore, notePlatform })

	const port = Number(process.env.PORT ?? DEFAULT_PORT)

	console.log(`Server starting on http://localhost:${port}`)

	serve({
		fetch: app.fetch,
		port,
	})

	console.log(`API backend ready!`)
	console.log(`  Health: http://localhost:${port}/health`)
	console.log(`  Queue:  http://localhost:${port}/api/queue`)
	console.log(`  Items:  http://localhost:${port}/api/items`)
	console.log(`  Stats:  http://localhost:${port}/api/stats`)
	console.log(`  Media:  http://localhost:${port}/api/media/*`)
}

main().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
