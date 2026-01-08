import { describe, expect, it } from 'vitest';
import { App, FakeElement } from 'obsidian';
import { StatsModal } from '../StatsModal';
import { appendReview } from '../../../data/revlog';
import { writeReviewItemFile } from '../../../data/review-items';
import type { ItemState } from '../../../core/types';

function collectText(element: FakeElement, acc: string[] = []): string[] {
	if (element.textContent) acc.push(element.textContent);
	for (const child of element.children) {
		collectText(child, acc);
	}
	return acc;
}

function makeState(): ItemState {
	return {
		status: 'review',
		due: new Date('2024-01-03T00:00:00'),
		stability: 1,
		difficulty: 1,
		reps: 1,
		lapses: 0,
		last_review: new Date('2024-01-02T00:00:00'),
	};
}

describe('StatsModal', () => {
	it('renders statistics blocks', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Source.md',
			['---', 'tags: [topic]', 'type: topic', 'priority: 10', '---', ''].join('\n'),
		);

		await writeReviewItemFile(app, 'note-1', {
			ir_note_id: 'note-1',
			note_path: note.path,
			type: 'topic',
			priority: 10,
			topic: makeState(),
		});

		await appendReview(app, { ts: '2024-01-02T12:00:00', item_id: 'note-1', rating: 3 });

		const modal = new StatsModal(app, 'topic');
		await modal.render();

		const text = collectText(modal.contentEl).join(' | ');
		expect(text).toContain('Statistics');
		expect(text).toContain('Reviews: 1');
		expect(text).toContain('Answer distribution');
		expect(text).toContain('7-day forecast');
		expect(text).toContain('Last 14 days');
	});
});
