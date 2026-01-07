import { describe, expect, it } from 'vitest';
import { App, TFile } from 'obsidian';
import { appendReview, readReviewsSince, readReviewsForItem, readAllReviews, getReviewCount } from '../../src/data/revlog';

function asFile(file: TFile | null): TFile {
	if (!file) throw new Error('missing file');
	return file;
}

describe('revlog storage', () => {
	it('appends and reads review records', async () => {
		const app = new App();

		await appendReview(app, { ts: '2024-01-01T10:00:00', item_id: 'a', rating: 3 });
		await appendReview(app, { ts: '2024-01-02T10:00:00', item_id: 'b', rating: 1 });

		const since = await readReviewsSince(app, new Date('2024-01-02T00:00:00'));
		expect(since.map((entry) => entry.item_id)).toEqual(['b']);

		const byItem = await readReviewsForItem(app, 'a');
		expect(byItem.map((entry) => entry.item_id)).toEqual(['a']);

		const all = await readAllReviews(app);
		expect(all).toHaveLength(2);

		const count = await getReviewCount(app);
		expect(count).toBe(2);

		const revlogPath = 'IR/Revlog/2024-01.md';
		const revlogFile = asFile(app.vault.getAbstractFileByPath(revlogPath) as TFile | null);
		const content = await app.vault.read(revlogFile);
		expect(content).toContain('"item_id":"a"');
		expect(content).toContain('"item_id":"b"');
	});
});
