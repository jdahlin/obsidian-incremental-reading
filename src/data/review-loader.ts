import { App, TFile } from 'obsidian';
import type { ItemState, ReviewItem } from '../core/types';
import { parseFrontmatter } from '../core/frontmatter';
import { readReviewItemFile } from './review-items';

const REVIEW_ITEMS_FOLDER = 'IR/Review Items/';

export async function loadReviewItems(app: App, extractTag: string): Promise<ReviewItem[]> {
	const files = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(REVIEW_ITEMS_FOLDER));
	const items: ReviewItem[] = [];
	const now = new Date();

	for (const file of files) {
		const noteId = file.basename;
		const data = await readReviewItemFile(app, noteId);
		if (!data || !data.note_path) continue;
		const noteFile = app.vault.getAbstractFileByPath(data.note_path);
		if (!(noteFile instanceof TFile)) continue;

		const frontmatter = app.metadataCache.getFileCache(noteFile)?.frontmatter ?? {};
		const parsed = parseFrontmatter(frontmatter, extractTag);
		if (!parsed) continue;

		const priority = parsed.priority;
		const created = parsed.created ?? null;

		if (data.topic) {
			items.push({
				id: data.ir_note_id,
				noteId: data.ir_note_id,
				notePath: data.note_path,
				noteFile,
				type: 'topic',
				clozeIndex: null,
				state: data.topic,
				priority,
				created,
			});
		}

		if (data.clozes) {
			for (const [key, entry] of Object.entries(data.clozes)) {
				const index = parseClozeIndex(key);
				if (!index) continue;
				items.push({
					id: `${data.ir_note_id}::${entry.cloze_uid}`,
					noteId: data.ir_note_id,
					notePath: data.note_path,
					noteFile,
					type: 'item',
					clozeIndex: index,
					state: entry ?? createDefaultState(now),
					priority,
					created,
				});
			}
		}
	}

	return items;
}

function parseClozeIndex(key: string): number | null {
	const match = key.match(/^c(\d+)$/);
	if (!match) return null;
	const index = Number(match[1]);
	return Number.isFinite(index) && index > 0 ? index : null;
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
