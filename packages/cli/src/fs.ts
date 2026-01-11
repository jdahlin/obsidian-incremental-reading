import type { FileSystem } from '@repo/core/data/FileSystem'
import type { NotePlatform } from '@repo/core/types'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Node.js filesystem adapter for CLI.
 * Implements both FileSystem and NotePlatform interfaces.
 */
export class NodeFileSystem implements FileSystem, NotePlatform {
	constructor(private basePath: string) {}

	// FileSystem interface

	async read(filePath: string): Promise<string | null> {
		try {
			const fullPath = path.join(this.basePath, filePath)
			return await fs.readFile(fullPath, 'utf-8')
		} catch (err) {
			if ((err as { code?: string }).code === 'ENOENT') {
				return null
			}
			throw err
		}
	}

	async write(filePath: string, content: string): Promise<void> {
		const fullPath = path.join(this.basePath, filePath)
		const dir = path.dirname(fullPath)
		await fs.mkdir(dir, { recursive: true })
		await fs.writeFile(fullPath, content, 'utf-8')
	}

	async delete(filePath: string): Promise<void> {
		try {
			const fullPath = path.join(this.basePath, filePath)
			await fs.unlink(fullPath)
		} catch (err) {
			if ((err as { code?: string }).code !== 'ENOENT') {
				throw err
			}
		}
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const fullPath = path.join(this.basePath, filePath)
			await fs.access(fullPath)
			return true
		} catch {
			return false
		}
	}

	async list(): Promise<string[]> {
		const files: string[] = []
		await this.listRecursive(this.basePath, '', files)
		return files
	}

	private async listRecursive(base: string, rel: string, files: string[]): Promise<void> {
		const dir = path.join(base, rel)
		let entries
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			const relPath = rel ? path.join(rel, entry.name) : entry.name
			if (entry.isDirectory()) {
				await this.listRecursive(base, relPath, files)
			} else if (entry.isFile()) {
				files.push(relPath)
			}
		}
	}

	// NotePlatform interface

	async getNote(noteId: string): Promise<string | null> {
		return this.read(noteId)
	}

	async setNote(noteId: string, content: string): Promise<void> {
		return this.write(noteId, content)
	}

	async getLinks(noteId: string): Promise<string[]> {
		const content = await this.getNote(noteId)
		if (content === null) return []

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

	// Utility methods

	resolvePath(filePath: string): string {
		return path.join(this.basePath, filePath)
	}
}
