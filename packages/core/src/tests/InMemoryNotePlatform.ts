import type { NotePlatform } from '../types';

export class InMemoryNotePlatform implements NotePlatform {
	private notes: Map<string, string> = new Map();
	private links: Map<string, string[]> = new Map();

	constructor(initialNotes: Record<string, string> = {}) {
		for (const [id, content] of Object.entries(initialNotes)) {
			this.notes.set(id, content);
		}
	}

	async getNote(noteId: string): Promise<string | null> {
		return this.notes.get(noteId) ?? null;
	}

	async setNote(noteId: string, content: string): Promise<void> {
		this.notes.set(noteId, content);
	}

	async getLinks(noteId: string): Promise<string[]> {
		return this.links.get(noteId) ?? [];
	}

	// Test helper
	addLink(fromNoteId: string, toNoteId: string): void {
		const links = this.links.get(fromNoteId) ?? [];
		if (!links.includes(toNoteId)) {
			links.push(toNoteId);
			this.links.set(fromNoteId, links);
		}
	}
}
