import type { NotePlatform } from '@repo/core/types'

import type { ApiClient } from './ApiClient'

/**
 * API-backed NotePlatform implementation.
 */
export class ApiNotePlatform implements NotePlatform {
	constructor(private api: ApiClient) {}

	async getNote(noteId: string): Promise<string | null> {
		try {
			// noteId is actually the item ID in our context
			// We need to get the content from the API
			const response = await this.api.getItemContent(noteId)
			return response.content
		} catch {
			return null
		}
	}

	async setNote(_noteId: string, _content: string): Promise<void> {
		// Note editing not supported in web version yet
		console.warn('setNote called on ApiNotePlatform - not implemented')
	}

	async getLinks(_noteId: string): Promise<string[]> {
		// Link parsing would need to be done on the server
		return []
	}
}
