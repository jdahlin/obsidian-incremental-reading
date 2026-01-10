/**
 * Markdown image extraction utilities.
 * Images are displayed using the ink-picture library.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ExtractedContent {
	/** Content with image placeholders */
	content: string;
	/** Full paths to images that should be rendered */
	imagePaths: string[];
}

/**
 * Extract images from markdown content.
 * Returns content with placeholders and list of image paths.
 */
export function extractImagesFromContent(content: string, vaultPath: string): ExtractedContent {
	const imagePaths: string[] = [];

	// Handle markdown-style ![alt](path)
	content = content.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		(_match: string, alt: string, imgPath: string) => {
			const fullPath = join(vaultPath, imgPath);
			if (existsSync(fullPath)) {
				imagePaths.push(fullPath);
				return `\n[Image ${imagePaths.length}]\n`;
			}
			return `[Image: ${alt || imgPath}]`;
		},
	);

	// Handle wiki-style ![[path]]
	content = content.replace(/!\[\[([^\]]+)\]\]/g, (_match: string, imgPath: string) => {
		const fullPath = join(vaultPath, imgPath);
		if (existsSync(fullPath)) {
			imagePaths.push(fullPath);
			return `\n[Image ${imagePaths.length}]\n`;
		}
		return `[Image: ${imgPath}]`;
	});

	return { content, imagePaths };
}

/**
 * Remove image markdown from content (for display when images are shown separately).
 */
export function removeImagesFromContent(content: string): string {
	// Remove markdown-style ![alt](path)
	content = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

	// Remove wiki-style ![[path]]
	content = content.replace(/!\[\[[^\]]+\]\]/g, '');

	// Clean up extra blank lines (more than 2 consecutive newlines)
	content = content.replace(/\n{3,}/g, '\n\n');

	return content;
}
