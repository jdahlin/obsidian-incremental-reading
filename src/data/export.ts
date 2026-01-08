import { App, TFile } from 'obsidian';
import { readAllReviews } from './revlog';
import { formatDate } from '../core/frontmatter';

export async function exportReviewHistory(app: App): Promise<TFile> {
	const reviews = await readAllReviews(app);
	const header = ['timestamp', 'item_id', 'rating', 'elapsed_ms'].join(',');
	const rows = reviews.map((review) => {
		const elapsed = review.elapsed_ms != null ? String(review.elapsed_ms) : '';
		return [review.ts, review.item_id, String(review.rating), elapsed].join(',');
	});
	const content = [header, ...rows].join('\n');

	const now = new Date();
	const fileName = `review-history-${formatDate(now).slice(0, 10)}.csv`;
	const folder = 'IR/Revlog';
	const path = `${folder}/${fileName}`;

	if (!(await app.vault.adapter.exists(folder))) {
		await app.vault.createFolder(folder);
	}

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return existing;
	}

	return app.vault.create(path, content);
}
