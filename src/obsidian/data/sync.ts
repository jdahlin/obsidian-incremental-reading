import { App, TFile } from 'obsidian';
import { parseClozeIndices } from '../../engine/core/cloze';
import { parseFrontmatter } from '../../engine/core/frontmatter';
import type { ItemState } from '../../engine/core/types';
import { createId } from './ids';
import {
	ensureNoteId,
	readReviewItemFile,
	writeReviewItemFile,
	deleteReviewItemFile,
	type ClozeEntry,
	type ReviewItemFile,
} from './review-items';

export async function syncNoteToSidecar(
	app: App,
	file: TFile,
	extractTag: string,
	frontmatterOverride?: Record<string, unknown>,
): Promise<void> {
	const frontmatter =
		frontmatterOverride ?? app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	const parsed = parseFrontmatter(frontmatter, extractTag);
	if (!parsed) {
		console.warn(
			`IR: Skipped syncing ${file.path} - frontmatter parsing failed (tag missing?)`,
		);
		return;
	}

	const noteId = parsed.ir_note_id || (await ensureNoteId(app, file));
	const content = await app.vault.read(file);
	const indices = parseClozeIndices(content);
	const clozeKeys = indices.map((index) => `c${index}`);
	const existing = await readReviewItemFile(app, noteId);
	const now = new Date();

	const topicState = existing?.topic ?? createDefaultState(now);
	const existingClozes = existing?.clozes ?? {};
	const clozes: Record<string, ClozeEntry> = {};

	for (const index of indices) {
		const key = `c${index}`;
		const current = existingClozes[key];
		clozes[key] = {
			cloze_uid: current?.cloze_uid ?? createId(),
			...(current ?? createDefaultState(now)),
		};
	}

	const updated: ReviewItemFile = {
		ir_note_id: noteId,
		note_path: file.path,
		type: parsed.type,
		priority: parsed.priority,
		cloze: clozeKeys.length ? clozeKeys : undefined,
		topic: topicState,
		clozes: Object.keys(clozes).length ? clozes : undefined,
	};

	await writeReviewItemFile(app, noteId, updated);
}

export async function syncAllNotes(app: App, extractTag: string): Promise<void> {
	const files = app.vault.getMarkdownFiles();
	const syncedPaths = new Set<string>();
	for (const file of files) {
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		if (!parseFrontmatter(frontmatter, extractTag)) continue;
		await syncNoteToSidecar(app, file, extractTag);
		syncedPaths.add(file.path);
	}

	const reviewFiles = app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith('IR/Review Items/'));
	for (const sidecar of reviewFiles) {
		const noteId = sidecar.basename;
		const data = await readReviewItemFile(app, noteId);
		if (!data) continue;
		const notePath = data.note_path;
		if (!notePath || !app.vault.getAbstractFileByPath(notePath) || !syncedPaths.has(notePath)) {
			await deleteReviewItemFile(app, noteId);
		}
	}
}

function createDefaultState(now: Date): ItemState {
	return {
		status: 'new',
		due: now,
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		last_review: null,
	};
}
