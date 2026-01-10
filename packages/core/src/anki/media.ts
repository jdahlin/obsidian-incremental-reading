/**
 * Media file handling for Anki import.
 * Copies media files from Anki's collection.media folder to Obsidian vault.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface MediaMapping {
	[numericName: string]: string; // "0" → "image.png"
}

/**
 * Read Obsidian's attachment folder config from .obsidian/app.json.
 * Falls back to 'attachments' if not configured.
 */
export function getAttachmentFolder(vaultPath: string): string {
	const configPath = join(vaultPath, '.obsidian', 'app.json');
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
				attachmentFolderPath?: string;
			};
			if (config.attachmentFolderPath !== undefined && config.attachmentFolderPath !== '') {
				return config.attachmentFolderPath;
			}
		} catch {
			// Ignore parse errors, use default
		}
	}
	return 'attachments';
}

/**
 * Read Anki's media mapping file.
 * The 'media' file maps numeric filenames to original names.
 */
export function readMediaMapping(ankiProfilePath: string): MediaMapping {
	const mediaFile = join(ankiProfilePath, 'media');
	if (!existsSync(mediaFile)) {
		return {};
	}
	try {
		return JSON.parse(readFileSync(mediaFile, 'utf-8')) as MediaMapping;
	} catch {
		return {};
	}
}

/**
 * Build a reverse mapping from original filenames to numeric names.
 */
export function buildReverseMediaMapping(mapping: MediaMapping): Map<string, string> {
	const reverse = new Map<string, string>();
	for (const [num, name] of Object.entries(mapping)) {
		reverse.set(name, num);
	}
	return reverse;
}

export interface CopyMediaResult {
	copied: Map<string, string>; // original filename → vault path
	missing: string[]; // files that couldn't be found
}

/**
 * Copy media files from Anki to vault's attachment folder.
 * Supports both legacy (numeric filenames with mapping) and modern (direct filenames) Anki.
 */
export function copyMediaFiles(
	ankiProfilePath: string,
	vaultPath: string,
	referencedFiles: Set<string>,
): CopyMediaResult {
	const attachmentFolder = getAttachmentFolder(vaultPath);
	const mediaDir = join(ankiProfilePath, 'collection.media');

	const copied = new Map<string, string>();
	const missing: string[] = [];

	// Ensure attachment folder exists
	const attachmentPath = join(vaultPath, attachmentFolder);
	if (!existsSync(attachmentPath)) {
		mkdirSync(attachmentPath, { recursive: true });
	}

	// Check if there's a media mapping file (legacy Anki)
	const mapping = readMediaMapping(ankiProfilePath);
	const hasMapping = Object.keys(mapping).length > 0;
	const reverseMap = hasMapping ? buildReverseMediaMapping(mapping) : null;

	for (const filename of referencedFiles) {
		let srcPath: string;

		if (reverseMap !== null) {
			// Legacy: use mapping to find numeric filename
			const numericName = reverseMap.get(filename);
			if (numericName === undefined) {
				missing.push(filename);
				continue;
			}
			srcPath = join(mediaDir, numericName);
		} else {
			// Modern: files use their actual names directly
			srcPath = join(mediaDir, filename);
		}

		const destPath = join(attachmentPath, filename);

		if (existsSync(srcPath)) {
			// Ensure parent directory exists (for nested paths)
			const parentDir = dirname(destPath);
			if (!existsSync(parentDir)) {
				mkdirSync(parentDir, { recursive: true });
			}

			copyFileSync(srcPath, destPath);
			copied.set(filename, `${attachmentFolder}/${filename}`);
		} else {
			missing.push(filename);
		}
	}

	return { copied, missing };
}

/**
 * Get the default Anki profile path on macOS.
 */
export function getDefaultAnkiPath(): string {
	const home = process.env.HOME ?? '';
	return join(home, 'Library', 'Application Support', 'Anki2', 'User 1');
}
