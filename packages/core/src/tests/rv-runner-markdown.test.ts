import type { NotePlatform, SessionConfig } from '../types';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownDataStore } from '../data/MarkdownDataStore';
import { parseRvScript, runRvCommands } from '../rv';
import { SessionManager } from '../SessionManager';
import { MarkdownEngineStore } from './MarkdownEngineStore';
import { MockFileSystem } from './MockFileSystem';

const rvDir = join(process.cwd(), 'tests', 'rv');

const files = readdirSync(rvDir)
	.filter((name) => name.endsWith('.rv'))
	.sort();

class VaultNotePlatform implements NotePlatform {
	constructor(private vault: MockFileSystem) {}

	async getNote(noteId: string): Promise<string | null> {
		return this.vault.read(`${noteId}.md`);
	}

	async setNote(noteId: string, content: string): Promise<void> {
		await this.vault.write(`${noteId}.md`, content);
	}

	async getLinks(_noteId: string): Promise<string[]> {
		return [];
	}
}

describe('.rv script runner (MarkdownDataStore)', () => {
	files.forEach((file) => {
		it(`runs ${file}`, async () => {
			const filePath = join(rvDir, file);
			const content = readFileSync(filePath, 'utf8');
			const commands = parseRvScript(content);

			const factory = async () => {
				const vault = new MockFileSystem();
				const platform = new VaultNotePlatform(vault);
				const dataStore = new MarkdownDataStore(vault, platform);
				const store = new MarkdownEngineStore(dataStore, vault);

				const config: SessionConfig = {
					strategy: 'JD1',
					mode: 'review',
					examDate: null,
					deterministic: true,
				};

				const sessionManager = new SessionManager(dataStore, platform, config);

				return { store, sessionManager, platform };
			};

			await expect(runRvCommands(commands, factory)).resolves.not.toThrow();
		});
	});
});
