import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { appendReview } from '../../src/data/revlog';
import { exportReviewHistory } from '../../src/data/export';
import { formatDate } from '../../src/core/frontmatter';

describe('review history export', () => {
	it('writes a CSV file with review history', async () => {
		const app = new App();
		await appendReview(app, {
			ts: '2024-01-01T10:00:00',
			item_id: 'a',
			rating: 3,
			elapsed_ms: 1200,
		});
		await appendReview(app, { ts: '2024-01-02T10:00:00', item_id: 'b', rating: 1 });

		const expectedDate = formatDate(new Date()).slice(0, 10);
		const file = await exportReviewHistory(app);

		expect(file.path).toBe(`IR/Revlog/review-history-${expectedDate}.csv`);
		const content = await app.vault.read(file);
		expect(content.split('\n')[0]).toBe('timestamp,item_id,rating,elapsed_ms');
		expect(content).toContain('2024-01-01T10:00:00,a,3,1200');
		expect(content).toContain('2024-01-02T10:00:00,b,1,');
	});
});
