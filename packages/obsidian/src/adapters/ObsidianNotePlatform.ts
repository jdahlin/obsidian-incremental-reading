import type { NotePlatform } from '@repo/core/types'
import type { App } from 'obsidian'
import { TFile } from 'obsidian'

/**
 * Adapts Obsidian's vault and metadata cache to the engine's NotePlatform interface.
 * Provides note content access and link resolution.
 */
export class ObsidianNotePlatform implements NotePlatform {
	constructor(private app: App) {}

	async getNote(noteId: string): Promise<string | null> {
		const file = this.findNoteById(noteId)
		if (!file) return null
		return this.app.vault.read(file)
	}

	async setNote(noteId: string, content: string): Promise<void> {
		const file = this.findNoteById(noteId)
		if (!file) return
		await this.app.vault.modify(file, content)
	}

	async getLinks(noteId: string): Promise<string[]> {
		const file = this.findNoteById(noteId)
		if (!file) return []

		const cache = this.app.metadataCache.getFileCache(file)
		if (!cache) return []

		const linkedNoteIds: string[] = []

		// Get outgoing links
		const links = cache.links ?? []
		for (const link of links) {
			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path)
			if (linkedFile instanceof TFile) {
				const linkedNoteId = this.getNoteId(linkedFile)
				if (linkedNoteId !== null) linkedNoteIds.push(linkedNoteId)
			}
		}

		// Get embed links (e.g., ![[note]])
		const embeds = cache.embeds ?? []
		for (const embed of embeds) {
			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path)
			if (linkedFile instanceof TFile) {
				const linkedNoteId = this.getNoteId(linkedFile)
				if (linkedNoteId !== null) linkedNoteIds.push(linkedNoteId)
			}
		}

		return linkedNoteIds
	}

	private findNoteById(noteId: string): TFile | null {
		// Search all markdown files for one with matching ir_note_id
		const files = this.app.vault.getMarkdownFiles()
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file)
			const frontmatter = cache?.frontmatter
			if (frontmatter?.ir_note_id === noteId) {
				return file
			}
		}
		return null
	}

	private getNoteId(file: TFile): string | null {
		const cache = this.app.metadataCache.getFileCache(file)
		const frontmatter = cache?.frontmatter
		if (frontmatter?.ir_note_id !== undefined && typeof frontmatter.ir_note_id === 'string') {
			return frontmatter.ir_note_id
		}
		return null
	}
}
