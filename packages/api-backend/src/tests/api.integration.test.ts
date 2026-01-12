import type { ServerType } from '@hono/node-server'

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { serve } from '@hono/node-server'
import { MarkdownDataStore } from '@repo/core/data/MarkdownDataStore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NodeFileSystem } from '../fs/NodeFileSystem'
import { NodeNotePlatform } from '../platforms/NodeNotePlatform'
import { createServer } from '../server'

describe('api integration tests', () => {
	let server: ServerType
	let baseUrl: string
	let vaultPath: string

	beforeAll(async () => {
		// Create a temporary vault with test data
		vaultPath = await mkdtemp(join(tmpdir(), 'ir-test-vault-'))

		// Create IR folder structure
		await mkdir(join(vaultPath, 'IR', 'Review Items'), { recursive: true })
		await mkdir(join(vaultPath, 'IR', 'Revlog'), { recursive: true })

		// Create a test note
		await writeFile(
			join(vaultPath, 'test-note.md'),
			`---
title: Test Note
---

# Test Note

This is a test note with a {{c1::cloze deletion}}.

Some more content here.
`,
		)

		// Create a review item file
		await writeFile(
			join(vaultPath, 'IR', 'Review Items', 'test-note-id.md'),
			`---
ir_note_id: test-note-id
note_path: test-note.md
type: topic
priority: 75
clozes:
  c1:
    cloze_uid: abc123
    status: new
    due: null
    stability: 0
    difficulty: 0
    reps: 0
    lapses: 0
    last_review: null
---
`,
		)

		// Create dependencies
		const fs = new NodeFileSystem(vaultPath)
		const notePlatform = new NodeNotePlatform(fs)
		const dataStore = new MarkdownDataStore(fs, notePlatform)

		// Create and start server
		const app = createServer({ fs, dataStore, notePlatform })

		// Find an available port
		const port = 3099 + Math.floor(Math.random() * 100)
		baseUrl = `http://localhost:${port}`

		server = serve({
			fetch: app.fetch,
			port,
		})

		// Wait for server to be ready
		await new Promise((resolve) => setTimeout(resolve, 100))
	})

	afterAll(async () => {
		// Close server
		if (server !== undefined) {
			server.close()
		}

		// Clean up temp vault
		if (vaultPath !== undefined) {
			await rm(vaultPath, { recursive: true, force: true })
		}
	})

	describe('health check', () => {
		it('should return ok status', async () => {
			const response = await fetch(`${baseUrl}/health`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { status: string }
			expect(data.status).toBe('ok')
		})
	})

	describe('queue endpoints', () => {
		it('returns items from GET /api/queue', async () => {
			const response = await fetch(`${baseUrl}/api/queue`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { items: unknown[]; total: number }
			expect(data).toHaveProperty('items')
			expect(data).toHaveProperty('total')
			expect(Array.isArray(data.items)).toBe(true)
		})

		it('returns deck tree from GET /api/queue/folders', async () => {
			const response = await fetch(`${baseUrl}/api/queue/folders`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { decks: unknown[]; allCounts: object }
			expect(data).toHaveProperty('decks')
			expect(data).toHaveProperty('allCounts')
		})
	})

	describe('items endpoints', () => {
		it('returns item details from GET /api/items/:id', async () => {
			const response = await fetch(`${baseUrl}/api/items/test-note-id`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { id: string; notePath: string }
			expect(data.id).toBe('test-note-id')
			expect(data.notePath).toBe('test-note.md')
		})

		it('returns note content from GET /api/items/:id/content', async () => {
			const response = await fetch(`${baseUrl}/api/items/test-note-id/content`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { content: string }
			expect(data.content).toContain('Test Note')
			expect(data.content).toContain('cloze deletion')
		})

		it('returns 404 for unknown item', async () => {
			const response = await fetch(`${baseUrl}/api/items/nonexistent`)
			expect(response.status).toBe(404)
		})

		it('submits a review via POST /api/items/:id/review', async () => {
			const response = await fetch(`${baseUrl}/api/items/test-note-id/review`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rating: 3, elapsedMs: 5000 }),
			})
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { success: boolean; newState: object }
			expect(data.success).toBe(true)
			expect(data.newState).toBeDefined()
		})

		it('rejects invalid rating in review', async () => {
			const response = await fetch(`${baseUrl}/api/items/test-note-id/review`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rating: 5 }), // Invalid: max is 4
			})
			expect(response.ok).toBe(false)
		})
	})

	describe('stats endpoints', () => {
		it('returns statistics from GET /api/stats', async () => {
			const response = await fetch(`${baseUrl}/api/stats`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { counts: object; dueCount: number }
			expect(data).toHaveProperty('counts')
			expect(data).toHaveProperty('dueCount')
		})

		it('returns streak info from GET /api/stats/streak', async () => {
			const response = await fetch(`${baseUrl}/api/stats/streak`)
			expect(response.ok).toBe(true)

			const data = (await response.json()) as { streak: { current: number; longest: number } }
			expect(data.streak).toHaveProperty('current')
			expect(data.streak).toHaveProperty('longest')
		})
	})

	describe('media endpoints', () => {
		it('returns 404 for nonexistent media file', async () => {
			const response = await fetch(`${baseUrl}/api/media/nonexistent.png`)
			expect(response.status).toBe(404)
		})
	})
})
