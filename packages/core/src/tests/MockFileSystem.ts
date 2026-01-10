import type { FileSystem } from '../data/FileSystem';

export class MockFileSystem implements FileSystem {
	private files: Map<string, string> = new Map();

	async read(path: string): Promise<string | null> {
		return this.files.get(path) ?? null;
	}

	async write(path: string, content: string): Promise<void> {
		this.files.set(path, content);
	}

	async delete(path: string): Promise<void> {
		this.files.delete(path);
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async list(): Promise<string[]> {
		return Array.from(this.files.keys());
	}
}
