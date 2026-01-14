#!/usr/bin/env node

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

	process.stdout.write(`Starting API backend for vault: ${absolutePath}\n`)

	// Create dependencies
	const fs = new NodeFileSystem(absolutePath)
	const notePlatform = new NodeNotePlatform(fs)
	const baseDataStore = new MarkdownDataStore(fs, notePlatform)
	const cachingDataStore = new CachingDataStore(baseDataStore)

	// Initialize cache before starting server
	process.stdout.write('Loading vault data into cache...\n')
	await cachingDataStore.initialize()

	// Create and start server
	const app = createServer({ fs, dataStore: cachingDataStore, cachingDataStore, notePlatform })

	const port = Number(process.env.PORT ?? DEFAULT_PORT)

	process.stdout.write(`Server starting on http://localhost:${port}\n`)

	serve({
		fetch: app.fetch,
		port,
	})

	process.stdout.write('API backend ready!\n')
	process.stdout.write(`  Health: http://localhost:${port}/health\n`)
	process.stdout.write(`  Queue:  http://localhost:${port}/api/queue\n`)
	process.stdout.write(`  Items:  http://localhost:${port}/api/items\n`)
	process.stdout.write(`  Stats:  http://localhost:${port}/api/stats\n`)
	process.stdout.write(`  Media:  http://localhost:${port}/api/media/*\n`)
}

main().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
