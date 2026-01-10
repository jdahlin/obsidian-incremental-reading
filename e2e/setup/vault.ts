/**
 * Test vault setup utilities for Playwright E2E tests.
 *
 * Creates a fresh test vault with the plugin installed for each test run.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface VaultConfig {
	vaultPath: string;
	pluginId: string;
}

const PLUGIN_ID = 'incremental-reading';

/**
 * Create a fresh test vault with the plugin installed.
 */
export async function createTestVault(basePath: string): Promise<VaultConfig> {
	const vaultPath = path.join(basePath, `test-vault-${Date.now()}`);

	// Create vault directory structure
	await fs.mkdir(vaultPath, { recursive: true });
	await fs.mkdir(path.join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID), { recursive: true });

	// Copy plugin files
	const projectRoot = path.resolve(__dirname, '../..');
	const pluginDest = path.join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID);

	// Required plugin files
	const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];

	for (const file of filesToCopy) {
		const src = path.join(projectRoot, file);
		if (existsSync(src)) {
			await fs.copyFile(src, path.join(pluginDest, file));
		}
	}

	// Create minimal Obsidian config to enable the plugin
	const communityPlugins = JSON.stringify([PLUGIN_ID]);
	await fs.writeFile(
		path.join(vaultPath, '.obsidian', 'community-plugins.json'),
		communityPlugins,
	);

	// App config - disable safe mode to allow community plugins
	const appConfig = JSON.stringify({
		alwaysUpdateLinks: true,
		newLinkFormat: 'shortest',
		useMarkdownLinks: false,
		showUnsupportedFiles: false,
		promptDelete: false,
	});
	await fs.writeFile(path.join(vaultPath, '.obsidian', 'app.json'), appConfig);

	// Core plugins config
	const corePlugins = JSON.stringify({
		'file-explorer': true,
		'global-search': true,
		switcher: true,
		'markdown-importer': false,
		'page-preview': true,
		'command-palette': true,
		'editor-status': true,
	});
	await fs.writeFile(path.join(vaultPath, '.obsidian', 'core-plugins.json'), corePlugins);

	return {
		vaultPath,
		pluginId: PLUGIN_ID,
	};
}

/**
 * Create a test note in the vault.
 */
export async function createNote(
	vaultPath: string,
	name: string,
	content: string,
	folder?: string,
): Promise<string> {
	const dir = folder ? path.join(vaultPath, folder) : vaultPath;
	await fs.mkdir(dir, { recursive: true });

	const filePath = path.join(dir, `${name}.md`);
	await fs.writeFile(filePath, content);
	return filePath;
}

/**
 * Read a note from the vault.
 */
export async function readNote(vaultPath: string, name: string, folder?: string): Promise<string> {
	const dir = folder ? path.join(vaultPath, folder) : vaultPath;
	const filePath = path.join(dir, `${name}.md`);
	return fs.readFile(filePath, 'utf-8');
}

/**
 * Check if a sidecar file exists for a note.
 */
export async function sidecarExists(vaultPath: string, noteId: string): Promise<boolean> {
	const sidecarPath = path.join(vaultPath, 'IR', 'Review Items', `${noteId}.md`);
	return existsSync(sidecarPath);
}

/**
 * Read sidecar content.
 */
export async function readSidecar(vaultPath: string, noteId: string): Promise<string> {
	const sidecarPath = path.join(vaultPath, 'IR', 'Review Items', `${noteId}.md`);
	return fs.readFile(sidecarPath, 'utf-8');
}

/**
 * Clean up test vault after tests.
 */
export async function cleanupVault(vaultPath: string): Promise<void> {
	await fs.rm(vaultPath, { recursive: true, force: true });
}
