import { describe, expect, it } from 'vitest';
import { App, Editor, FakeElement, MarkdownView } from 'obsidian';
import { writeReviewItemFile } from '../../../data/review-items';
import type { ItemState } from '../../../core/types';
import { ReviewController } from '../review-controller';
import { extractToIncrementalNote } from '../../../commands/extract';

function makeState(): ItemState {
	return {
		status: 'review',
		due: new Date('2024-01-02T00:00:00'),
		stability: 1,
		difficulty: 1,
		reps: 1,
		lapses: 0,
		last_review: new Date('2024-01-01T00:00:00'),
	};
}

async function withDocument<T>(fn: () => Promise<T> | T): Promise<T> {
	const previousDocument = globalThis.document;
	globalThis.document = { createElement: () => new FakeElement() } as unknown as Document;
	try {
		return await fn();
	} finally {
		globalThis.document = previousDocument;
	}
}

describe('ReviewController', () => {
	it('loads summary data and advances through grading', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Deck/Note.md',
			[
				'---',
				'ir_note_id: note-1',
				'tags: [topic]',
				'type: topic',
				'priority: 10',
				'created: 2024-01-01T00:00:00',
				'---',
				'Body {{c1::cloze}}',
			].join('\n'),
		);
		app.workspace.setActiveFile(note);

		const state = makeState();
		await writeReviewItemFile(app, 'note-1', {
			ir_note_id: 'note-1',
			note_path: note.path,
			type: 'topic',
			priority: 10,
			topic: state,
			clozes: {
				c1: { cloze_uid: 'uid-1', ...state },
			},
		});

		const controller = new ReviewController({
			app,
			view: {},
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		await withDocument(() => controller.refreshSummary());
		const model = controller.getModel();
		expect(model.items).toHaveLength(2);
		expect(model.selectedPath).toBe('Notes/Deck');

		await withDocument(() => controller.startReview());
		expect(controller.getModel().screen).toBe('review');
		expect(controller.getModel().currentItem).not.toBeNull();

		await withDocument(() => controller.gradeCurrentItem(3));
		expect(controller.getModel().sessionStats.reviewed).toBe(1);
	});

	it.each(['topic', 'extract'])(
		'%s: includes newly created review items (via extract command)',
		async (type: string) => {
			const app = new App();
			const source = await app.vault.create('Notes/Deck/Source.md', 'Source body');
			app.workspace.setActiveFile(source);

			const selection = 'Text with {{c1::CLOZE}}';
			const editor = new Editor(selection, 0, selection.length);
			const view = new MarkdownView(source);
			await extractToIncrementalNote(app, editor, view, { titleWords: 5, tag: type });

			const reviewFiles = app.vault
				.getMarkdownFiles()
				.filter((file) => file.path.startsWith('IR/Review Items/'));
			expect(reviewFiles).toHaveLength(1);
			const noteId = reviewFiles[0]?.basename;

			const controller = new ReviewController({
				app,
				view: {},
				settings: {
					newCardsPerDay: 10,
					maximumInterval: 30,
					requestRetention: 0.9,
					extractTag: type,
					trackReviewTime: false,
					showStreak: true,
				},
			});

			await withDocument(() => controller.refreshSummary());
			expect(controller.getModel().items.some((item) => item.noteId === noteId)).toBe(true);
		},
	);

	it('includes root-level notes in the summary', async () => {
		const app = new App();
		const source = await app.vault.create('RootSource.md', 'Source body content');
		app.workspace.setActiveFile(source);

		const selection = 'Extracted content from root';
		const editor = new Editor(selection, 0, selection.length);
		const view = new MarkdownView(source);

		await extractToIncrementalNote(app, editor, view, { titleWords: 5, tag: 'topic' });

		const controller = new ReviewController({
			app,
			view: {},
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		await withDocument(() => controller.refreshSummary());
		const model = controller.getModel();

		// Root items should be represented in the deck tree (e.g. as '/')
		expect(model.decks.length).toBeGreaterThan(0);
		expect(model.decks.some((d) => d.path === '/')).toBe(true);
	});
});
