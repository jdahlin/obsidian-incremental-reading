/**
 * Obsidian installation and launch utilities for E2E tests.
 *
 * Downloads Obsidian and provides launch configuration for Playwright.
 * Currently supports macOS only.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// Obsidian release info
const OBSIDIAN_VERSION = '1.7.7';
const OBSIDIAN_DMG_URL = `https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}-universal.dmg`;

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const DMG_PATH = path.join(CACHE_DIR, `Obsidian-${OBSIDIAN_VERSION}.dmg`);
const APP_PATH = path.join(CACHE_DIR, 'Obsidian.app');

/**
 * Download Obsidian DMG if not already cached.
 */
async function downloadObsidian(): Promise<string> {
	await fs.mkdir(CACHE_DIR, { recursive: true });

	if (existsSync(DMG_PATH)) {
		console.log(`Using cached Obsidian ${OBSIDIAN_VERSION} DMG`);
		return DMG_PATH;
	}

	console.log(`Downloading Obsidian ${OBSIDIAN_VERSION}...`);

	// Download using curl
	execSync(`curl -L -o "${DMG_PATH}" "${OBSIDIAN_DMG_URL}"`, {
		stdio: 'inherit',
	});

	console.log('Obsidian downloaded successfully');
	return DMG_PATH;
}

/**
 * Extract Obsidian.app from the DMG.
 */
export async function ensureObsidianInstalled(): Promise<string> {
	if (existsSync(APP_PATH)) {
		console.log('Using cached Obsidian.app');
		return APP_PATH;
	}

	const dmgPath = await downloadObsidian();

	console.log('Mounting DMG and extracting Obsidian.app...');

	// Mount the DMG
	const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, {
		encoding: 'utf-8',
	});

	// Parse mount point from output (last column of last line)
	const lines = mountOutput.trim().split('\n');
	const lastLine = lines[lines.length - 1];
	const mountPoint = lastLine.split('\t').pop()?.trim();

	if (!mountPoint) {
		throw new Error('Failed to determine DMG mount point');
	}

	try {
		// Copy Obsidian.app to cache
		const sourceApp = path.join(mountPoint, 'Obsidian.app');
		execSync(`cp -R "${sourceApp}" "${APP_PATH}"`, { stdio: 'inherit' });
		console.log('Obsidian.app extracted successfully');
	} finally {
		// Unmount the DMG
		execSync(`hdiutil detach "${mountPoint}" -quiet`, { stdio: 'inherit' });
	}

	return APP_PATH;
}

/**
 * Get the path to the Obsidian executable for Playwright.
 */
export function getObsidianExecutable(appPath: string): string {
	return path.join(appPath, 'Contents', 'MacOS', 'Obsidian');
}

/**
 * Configuration for Playwright Electron launch.
 */
export interface ObsidianLaunchConfig {
	executablePath: string;
	args: string[];
	env: NodeJS.ProcessEnv;
}

/**
 * Get Playwright-compatible launch configuration.
 */
export async function getPlaywrightConfig(vaultPath: string): Promise<ObsidianLaunchConfig> {
	const appPath = await ensureObsidianInstalled();
	const executable = getObsidianExecutable(appPath);

	return {
		executablePath: executable,
		args: [`obsidian://open?path=${encodeURIComponent(vaultPath)}`],
		env: {
			...process.env,
		},
	};
}

// Allow running directly to pre-download Obsidian
if (require.main === module) {
	ensureObsidianInstalled()
		.then((appPath) => console.log(`Obsidian ready at: ${appPath}`))
		.catch(console.error);
}
