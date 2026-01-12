import type { ServerDeps } from '../server'

import { Hono } from 'hono'

export function createMediaRoutes(deps: ServerDeps): Hono {
	const app = new Hono()

	/**
	 * GET /api/media/*
	 * Serves media files from the vault.
	 */
	app.get('/*', async (c) => {
		// Get the path after /api/media/
		const path = c.req.path.replace(/^\/api\/media\//, '')

		if (path === '' || path === '/') {
			return c.json({ error: 'Path required' }, 400)
		}

		// Decode URI component to handle spaces and special characters
		const decodedPath = decodeURIComponent(path)

		// Read the file as binary
		const data = await deps.fs.readBinary(decodedPath)

		if (data === null) {
			return c.json({ error: 'File not found' }, 404)
		}

		// Determine content type from extension
		const contentType = getContentType(decodedPath)

		return new Response(data, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000',
			},
		})
	})

	return app
}

function getContentType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase()

	const mimeTypes: Record<string, string> = {
		// Images
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		ico: 'image/x-icon',

		// Audio
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		ogg: 'audio/ogg',

		// Video
		mp4: 'video/mp4',
		webm: 'video/webm',

		// Documents
		pdf: 'application/pdf',

		// Other
		json: 'application/json',
		txt: 'text/plain',
	}

	return mimeTypes[ext ?? ''] ?? 'application/octet-stream'
}
