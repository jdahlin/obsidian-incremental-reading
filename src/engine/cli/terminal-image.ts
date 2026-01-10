/**
 * Terminal image display using iTerm2 inline images protocol.
 * Works in iTerm2, kitty, WezTerm, and other modern terminals.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Generate iTerm2 inline image escape sequence.
 * Returns empty string if image cannot be read.
 */
export function inlineImage(
	imagePath: string,
	options: { width?: number; height?: number; preserveAspectRatio?: boolean } = {},
): string {
	if (!existsSync(imagePath)) {
		return `[Missing: ${imagePath}]`;
	}

	try {
		const data = readFileSync(imagePath);
		const base64 = data.toString('base64');

		// Build options string
		const opts: string[] = ['inline=1'];
		if (options.width) opts.push(`width=${options.width}`);
		if (options.height) opts.push(`height=${options.height}`);
		if (options.preserveAspectRatio !== false) opts.push('preserveAspectRatio=1');

		// iTerm2 escape sequence: OSC 1337 ; File=[options]:[base64] ST
		// Using \x1b] for OSC and \x07 for ST (string terminator)
		return `\x1b]1337;File=${opts.join(';')}:${base64}\x07`;
	} catch {
		return `[Error loading: ${imagePath}]`;
	}
}

/**
 * Check if terminal likely supports inline images.
 * This is a heuristic based on TERM_PROGRAM env var.
 */
export function supportsInlineImages(): boolean {
	const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? '';
	const term = process.env.TERM?.toLowerCase() ?? '';

	// Known terminals with iTerm2 image protocol support
	const supportedTerminals = ['iterm.app', 'wezterm', 'mintty', 'hyper'];
	if (supportedTerminals.some((t) => termProgram.includes(t))) {
		return true;
	}

	// Kitty uses its own protocol but also supports iTerm2's
	if (termProgram.includes('kitty') || term.includes('kitty')) {
		return true;
	}

	// Check for ITERM_SESSION_ID which indicates iTerm2
	if (process.env.ITERM_SESSION_ID) {
		return true;
	}

	return false;
}

/**
 * Render markdown content with images displayed inline.
 * Replaces image markdown with actual images or placeholders.
 */
export function renderContentWithImages(
	content: string,
	vaultPath: string,
	maxWidth?: number,
): string {
	const showImages = supportsInlineImages();

	// Handle markdown-style ![alt](path)
	content = content.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		(_match: string, alt: string, imgPath: string) => {
			if (showImages) {
				const fullPath = join(vaultPath, imgPath);
				const img = inlineImage(fullPath, { width: maxWidth });
				// Add newline before and after for proper display
				return `\n${img}\n`;
			}
			return `[Image: ${alt || imgPath}]`;
		},
	);

	// Handle wiki-style ![[path]]
	content = content.replace(/!\[\[([^\]]+)\]\]/g, (_match: string, imgPath: string) => {
		if (showImages) {
			const fullPath = join(vaultPath, imgPath);
			const img = inlineImage(fullPath, { width: maxWidth });
			return `\n${img}\n`;
		}
		return `[Image: ${imgPath}]`;
	});

	return content;
}
