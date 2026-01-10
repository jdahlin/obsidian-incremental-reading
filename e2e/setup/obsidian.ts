/**
 * Obsidian installation and launch utilities for E2E tests.
 *
 * Downloads Obsidian AppImage and provides launch configuration for Playwright.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';

// Obsidian release URL - update version as needed
const OBSIDIAN_VERSION = '1.7.7';
const OBSIDIAN_APPIMAGE_URL = `https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage`;

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const APPIMAGE_PATH = path.join(CACHE_DIR, `Obsidian-${OBSIDIAN_VERSION}.AppImage`);

/**
 * Download Obsidian AppImage if not already cached.
 */
export async function ensureObsidianInstalled(): Promise<string> {
	await fs.mkdir(CACHE_DIR, { recursive: true });

	if (existsSync(APPIMAGE_PATH)) {
		console.log(`Using cached Obsidian ${OBSIDIAN_VERSION}`);
		return APPIMAGE_PATH;
	}

	console.log(`Downloading Obsidian ${OBSIDIAN_VERSION}...`);

	// Download using curl (available on most systems)
	execSync(`curl -L -o "${APPIMAGE_PATH}" "${OBSIDIAN_APPIMAGE_URL}"`, {
		stdio: 'inherit',
	});

	// Make executable
	await fs.chmod(APPIMAGE_PATH, 0o755);

	console.log('Obsidian downloaded successfully');
	return APPIMAGE_PATH;
}

/**
 * Extract the Obsidian AppImage to a directory.
 * This allows Playwright to launch it as an Electron app.
 */
export async function extractObsidian(): Promise<string> {
	const extractDir = path.join(CACHE_DIR, `obsidian-${OBSIDIAN_VERSION}`);

	if (existsSync(path.join(extractDir, 'obsidian'))) {
		return extractDir;
	}

	const appImagePath = await ensureObsidianInstalled();

	console.log('Extracting Obsidian AppImage...');
	await fs.mkdir(extractDir, { recursive: true });

	// Extract AppImage
	execSync(`"${appImagePath}" --appimage-extract`, {
		cwd: extractDir,
		stdio: 'inherit',
	});

	// Move squashfs-root contents up
	const squashfsRoot = path.join(extractDir, 'squashfs-root');
	if (existsSync(squashfsRoot)) {
		const files = await fs.readdir(squashfsRoot);
		for (const file of files) {
			await fs.rename(path.join(squashfsRoot, file), path.join(extractDir, file));
		}
		await fs.rmdir(squashfsRoot);
	}

	return extractDir;
}

/**
 * Get the path to the Obsidian executable within the extracted directory.
 */
export function getObsidianExecutable(extractDir: string): string {
	return path.join(extractDir, 'obsidian');
}

/**
 * Get the path to the Obsidian resources for Playwright Electron launch.
 */
export function getObsidianResourcesPath(extractDir: string): string {
	return path.join(extractDir, 'resources', 'app.asar');
}

/**
 * Launch Obsidian with a specific vault for testing.
 * Returns the process so it can be managed by tests.
 */
export function launchObsidian(extractDir: string, vaultPath: string): ReturnType<typeof spawn> {
	const executable = getObsidianExecutable(extractDir);

	// Launch with specific vault
	const proc = spawn(executable, [vaultPath], {
		env: {
			...process.env,
			// Disable GPU for headless environments
			ELECTRON_DISABLE_GPU: '1',
			// Disable sandbox for CI environments
			ELECTRON_NO_SANDBOX: '1',
		},
		stdio: 'pipe',
	});

	return proc;
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
	const extractDir = await extractObsidian();
	const executable = getObsidianExecutable(extractDir);

	return {
		executablePath: executable,
		args: [vaultPath],
		env: {
			...process.env,
			ELECTRON_DISABLE_GPU: '1',
			ELECTRON_NO_SANDBOX: '1',
		},
	};
}
