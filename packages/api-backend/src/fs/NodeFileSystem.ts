import type { FileSystem } from '@repo/core/data/FileSystem'

import type { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

/**
 * Node.js implementation of FileSystem interface.
 * Operates relative to a root vault path.
 */
export class NodeFileSystem implements FileSystem {
	constructor(private rootPath: string) {}

	async read(path: string): Promise<string | null> {
		try {
			const fullPath = join(this.rootPath, path)
			const content = await readFile(fullPath, 'utf-8')
			return content
		} catch (err) {
			if (isNodeError(err) && err.code === 'ENOENT') {
				return null
			}
			throw err
		}
	}

	async write(path: string, content: string): Promise<void> {
		const fullPath = join(this.rootPath, path)
		const dir = dirname(fullPath)

		// Ensure parent directory exists
		await mkdir(dir, { recursive: true })
		await writeFile(fullPath, content, 'utf-8')
	}

	async delete(path: string): Promise<void> {
		try {
			const fullPath = join(this.rootPath, path)
			await unlink(fullPath)
		} catch (err) {
			if (isNodeError(err) && err.code === 'ENOENT') {
				// File doesn't exist, nothing to do
				return
			}
			throw err
		}
	}

	async exists(path: string): Promise<boolean> {
		try {
			const fullPath = join(this.rootPath, path)
			await stat(fullPath)
			return true
		} catch (err) {
			if (isNodeError(err) && err.code === 'ENOENT') {
				return false
			}
			throw err
		}
	}

	async list(): Promise<string[]> {
		const files: string[] = []
		await this.walkDir(this.rootPath, files)
		return files
	}

	/**
	 * Read a file as binary (for media files).
	 */
	async readBinary(path: string): Promise<Buffer | null> {
		try {
			const fullPath = join(this.rootPath, path)
			return await readFile(fullPath)
		} catch (err) {
			if (isNodeError(err) && err.code === 'ENOENT') {
				return null
			}
			throw err
		}
	}

	/**
	 * Get the absolute path for a relative path.
	 */
	getAbsolutePath(path: string): string {
		return join(this.rootPath, path)
	}

	private async walkDir(dir: string, files: string[]): Promise<void> {
		try {
			const entries = await readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = join(dir, entry.name)

				if (entry.isDirectory()) {
					// Skip hidden directories and node_modules
					if (entry.name.startsWith('.') || entry.name === 'node_modules') {
						continue
					}
					await this.walkDir(fullPath, files)
				} else if (entry.isFile()) {
					// Store relative path
					const relativePath = relative(this.rootPath, fullPath)
					files.push(relativePath)
				}
			}
		} catch (err) {
			if (isNodeError(err) && err.code === 'ENOENT') {
				// Directory doesn't exist
				return
			}
			throw err
		}
	}
}

interface NodeError extends Error {
	code?: string
}

function isNodeError(err: unknown): err is NodeError {
	return err instanceof Error && 'code' in err
}
