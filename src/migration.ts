import type { App, TFile } from 'obsidian';
import { normalizeNumber, normalizeStatus, parseDate, normalizeTags } from './core/frontmatter';
import type { ItemState } from './core/types';
import { ensureNoteId, updateTopicState } from './data/review-items';
import { syncNoteToSidecar } from './data/sync';

export async function runMigration(app: App, extractTag: string): Promise<void> {
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const tags = normalizeTags((frontmatter as Record<string, unknown>).tags);
		if (!tags.includes(extractTag)) continue;

		const legacyState = readLegacyState(frontmatter as Record<string, unknown>, file);
		await syncNoteToSidecar(app, file, extractTag);
		if (legacyState) {
			const noteId = await ensureNoteId(app, file);
			await updateTopicState(app, noteId, legacyState, file.path);
		}
	}
}

function readLegacyState(frontmatter: Record<string, unknown>, file: TFile): ItemState | null {
	const hasLegacy = ['due', 'status', 'stability', 'difficulty', 'reps', 'lapses', 'last_review']
		.some((key) => frontmatter[key] != null && frontmatter[key] !== '');
	if (!hasLegacy) return null;

	const created = parseDate(frontmatter.created) ?? new Date(file.stat.ctime);
	const due = parseDate(frontmatter.due) ?? created;

	return {
		status: normalizeStatus(frontmatter.status),
		due,
		stability: normalizeNumber(frontmatter.stability, 0),
		difficulty: normalizeNumber(frontmatter.difficulty, 0),
		reps: normalizeNumber(frontmatter.reps, 0),
		lapses: normalizeNumber(frontmatter.lapses, 0),
		last_review: parseDate(frontmatter.last_review),
	};
}
