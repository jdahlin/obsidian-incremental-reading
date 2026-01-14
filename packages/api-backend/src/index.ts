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
	const args = process.argv.slice(2).filter((value) => value !== '--')
	const vaultPath = args[0] ?? process.env.VAULT_PATH ?? './anki-vault'
	const absolutePath = vaultPath.startsWith('/') ? vaultPath : `${process.cwd()}/${vaultPath}`

	// Create dependencies
	const fs = new NodeFileSystem(absolutePath)
	const notePlatform = new NodeNotePlatform(fs)
	const baseDataStore = new MarkdownDataStore(fs, notePlatform)
	const cachingDataStore = new CachingDataStore(baseDataStore)

	await cachingDataStore.initialize()

	// Create and start server
	const app = createServer({ fs, dataStore: cachingDataStore, cachingDataStore, notePlatform })

	const port = Number(process.env.PORT ?? DEFAULT_PORT)

	serve({
		fetch: app.fetch,
		port,
	})
}

main().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
