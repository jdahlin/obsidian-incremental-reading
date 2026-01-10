import { TFile, TFolder, type App } from 'obsidian';
import type { FileSystem } from '../../engine/data/FileSystem';

/**
 * Implements the engine's FileSystem interface using Obsidian's vault API.
 * This allows MarkdownDataStore to work with Obsidian without any
 * Obsidian-specific code in the data layer.
 */
export class ObsidianVault implements FileSystem {
	constructor(private app: App) {}

	async read(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return this.app.vault.read(file);
		}
		// Try adapter for files not yet in cache
		if (await this.app.vault.adapter.exists(path)) {
			return this.app.vault.adapter.read(path);
		}
		return null;
	}

	async write(path: string, content: string): Promise<void> {
		// Ensure parent directories exist
		const parentPath = path.split('/').slice(0, -1).join('/');
		if (parentPath) {
			await this.ensureFolder(parentPath);
		}

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return;
		}

		// Race condition handling: file may be created between check and create
		try {
			await this.app.vault.create(path, content);
		} catch {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			}
		}
	}

	async delete(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.app.fileManager.trashFile(file);
			return;
		}
		// Try adapter for files not in cache
		if (await this.app.vault.adapter.exists(path)) {
			await this.app.vault.adapter.remove(path);
		}
	}

	async exists(path: string): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file) return true;
		return this.app.vault.adapter.exists(path);
	}

	async list(): Promise<string[]> {
		const files = this.app.vault.getMarkdownFiles();
		return files.map((f: TFile) => f.path);
	}

	private async ensureFolder(path: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;

		// Create parent folders recursively
		const parts = path.split('/');
		let currentPath = '';
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folder = this.app.vault.getAbstractFileByPath(currentPath);
			if (!folder) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch {
					// Already created by another operation
				}
			}
		}
	}
}
