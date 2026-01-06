import type { App, CachedMetadata, TFile } from 'obsidian';

export type TagQuery = string;

function normalizeTag(tag: string): string {
	const t = tag.trim();
	if (!t) return '';
	return t.startsWith('#') ? t : `#${t}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function collectTagsFromCache(cache: CachedMetadata | null | undefined): Set<string> {
	const out = new Set<string>();
	if (!cache) return out;

	// metadataCache tags includes both inline and frontmatter tags.
	if (cache.tags) {
		for (const t of cache.tags) out.add(t.tag);
	}

	// Robust fallback: also inspect frontmatter.tags when present.
	const fm = cache.frontmatter;
	if (isRecord(fm)) {
		const fmTags = fm['tags'];
		if (typeof fmTags === 'string') {
			out.add(normalizeTag(fmTags));
		} else if (Array.isArray(fmTags)) {
			for (const t of fmTags as unknown[]) {
				if (typeof t === 'string') out.add(normalizeTag(t));
			}
		}
	}

	return out;
}

/**
 * Efficient tag lookup using Obsidian's metadataCache.
 * Returns markdown files that contain the tag (inline or frontmatter).
 */
export function getNotesWithTag(app: App, tagQuery: TagQuery): TFile[] {
	const tag = normalizeTag(tagQuery);
	if (!tag) return [];

	const files = app.vault.getMarkdownFiles();
	const out: TFile[] = [];

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		const tags = collectTagsFromCache(cache);
		if (tags.has(tag)) out.push(file);
	}

	return out;
}
