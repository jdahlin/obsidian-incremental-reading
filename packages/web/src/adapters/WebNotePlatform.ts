import type { NotePlatform } from '@repo/core/types'

const STORAGE_KEY_NOTES = 'ir-notes'

/**
 * Web-based NotePlatform implementation using localStorage.
 */
export class WebNotePlatform implements NotePlatform {
	private notes: Map<string, string> = new Map()

	constructor() {
		this.loadFromStorage()
	}

	async getNote(noteId: string): Promise<string | null> {
		return this.notes.get(noteId) ?? null
	}

	async setNote(noteId: string, content: string): Promise<void> {
		this.notes.set(noteId, content)
		this.saveToStorage()
	}

	async getLinks(_noteId: string): Promise<string[]> {
		// Web version doesn't support links yet
		return []
	}

	/**
	 * Add a note to the platform.
	 */
	addNote(noteId: string, content: string): void {
		this.notes.set(noteId, content)
		this.saveToStorage()
	}

	/**
	 * Remove a note from the platform.
	 */
	removeNote(noteId: string): void {
		this.notes.delete(noteId)
		this.saveToStorage()
	}

	/**
	 * Clear all notes.
	 */
	clear(): void {
		this.notes.clear()
		localStorage.removeItem(STORAGE_KEY_NOTES)
	}

	/**
	 * Import notes from a map.
	 */
	importNotes(notes: Record<string, string>): void {
		for (const [id, content] of Object.entries(notes)) {
			this.notes.set(id, content)
		}
		this.saveToStorage()
	}

	private loadFromStorage(): void {
		try {
			const json = localStorage.getItem(STORAGE_KEY_NOTES)
			if (json !== null) {
				const notes = JSON.parse(json) as Record<string, string>
				for (const [id, content] of Object.entries(notes)) {
					this.notes.set(id, content)
				}
			}
		} catch (err) {
			console.error('Failed to load notes from localStorage:', err)
		}
	}

	private saveToStorage(): void {
		const notes: Record<string, string> = {}
		for (const [id, content] of this.notes) {
			notes[id] = content
		}
		localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes))
	}
}
