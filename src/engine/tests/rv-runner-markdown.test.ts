/* eslint-disable import/no-nodejs-modules, no-undef */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRvScript, runRvCommands } from '../rv';
import { MockVault } from './MockVault';
import { MarkdownDataStore } from '../data/MarkdownDataStore';
import { MarkdownEngineStore } from './MarkdownEngineStore';
import { SessionManager } from '../SessionManager';
import type { SessionConfig, NotePlatform } from '../types';

const rvDir = join(process.cwd(), 'tests', 'rv');

const files = readdirSync(rvDir)
	.filter((name) => name.endsWith('.rv'))
	.sort();

class VaultNotePlatform implements NotePlatform {
	constructor(private vault: MockVault) {}

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
				const vault = new MockVault();
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
