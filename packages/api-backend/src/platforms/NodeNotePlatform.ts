import type { NotePlatform } from '@repo/core/types'

import type { NodeFileSystem } from '../fs/NodeFileSystem'

/**
 * Node.js implementation of NotePlatform interface.
 * Uses the vault's file system to read/write notes.
 */
export class NodeNotePlatform implements NotePlatform {
	constructor(private fs: NodeFileSystem) {}

	async getNote(noteId: string): Promise<string | null> {
		return this.fs.read(noteId)
	}

	async setNote(noteId: string, content: string): Promise<void> {
		await this.fs.write(noteId, content)
	}

	async getLinks(noteId: string): Promise<string[]> {
		const content = await this.getNote(noteId)
		if (content === null) return []

		// Parse wiki-style links: [[Link]] or [[Link|Display]]
		const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
		const links: string[] = []
		let match
		while ((match = wikiLinkRegex.exec(content)) !== null) {
			if (match[1] !== undefined) {
				links.push(match[1])
			}
		}
		return links
	}
}
