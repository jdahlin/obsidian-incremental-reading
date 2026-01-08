import { describe, expect, it } from 'vitest';
import { App, FakeElement, WorkspaceLeaf } from 'obsidian';
import type IncrementalReadingPlugin from '../../src/main';
import { ReviewItemView } from '../../src/views/review/ReviewItemView';
import { writeReviewItemFile } from '../../src/data/review-items';
import { readAllReviews } from '../../src/data/revlog';
import type { ItemState } from '../../src/core/types';

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

describe('ReviewItemView', () => {
	function makePlugin(
		app: App,
		overrides?: Partial<IncrementalReadingPlugin['settings']>,
	): IncrementalReadingPlugin {
		return {
			app,
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				extractTitleWords: 5,
				trackReviewTime: false,
				showStreak: true,
				...overrides,
			},
		} as IncrementalReadingPlugin;
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

	it('loads summary data and advances through grading', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Deck/Note.md',
			[
				'---',
				'tags: [topic]',
				'type: topic',
				'priority: 10',
				'created: 2024-01-01T00:00:00',
				'---',
				'Body',
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

		const plugin = makePlugin(app);

		const leaf = new WorkspaceLeaf();
		const view = new ReviewItemView(leaf, app, plugin) as unknown as {
			refreshSummary: () => Promise<void>;
			startReview: () => Promise<void>;
			onGrade: (grade: number) => Promise<void>;
			renderView: () => void;
			items: unknown[];
			selectedPath: string | null;
			currentItem: unknown;
			screen: string;
			sessionStats: { reviewed: number };
		};

		view.renderView = () => undefined;

		await withDocument(() => view.refreshSummary());
		expect(view.items).toHaveLength(2);
		expect(view.selectedPath).toBe('Notes/Deck');

		await withDocument(() => view.startReview());
		expect(view.screen).toBe('review');
		expect(view.currentItem).not.toBeNull();

		await withDocument(() => view.onGrade(3));
		expect(view.sessionStats.reviewed).toBe(1);

		const reviews = await readAllReviews(app);
		expect(reviews).toHaveLength(1);
	});

	it('formats cloze content for question and answer phases', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Cloze.md',
			['---', 'tags: [topic]', 'type: item', '---', 'Start {{c1::alpha::hint}} End', ''].join(
				'\n',
			),
		);
		const plugin = makePlugin(app);
		const leaf = new WorkspaceLeaf();
		const view = new ReviewItemView(leaf, app, plugin) as unknown as {
			loadItemContent: () => Promise<void>;
			currentContent: string;
			phase: 'question' | 'answer';
			currentItem: unknown;
		};

		view.currentItem = {
			id: 'note-1::uid-1',
			noteId: 'note-1',
			notePath: note.path,
			noteFile: note,
			type: 'item',
			clozeIndex: 1,
			state: makeState(),
			priority: 10,
		};

		view.phase = 'question';
		await withDocument(() => view.loadItemContent());
		expect(view.currentContent).toContain('[...] (hint)');
		expect(view.currentContent).not.toContain('alpha');

		view.phase = 'answer';
		await withDocument(() => view.loadItemContent());
		expect(view.currentContent).toContain('alpha');
		expect(view.currentContent).not.toContain('[...]');
	});

	it('shows answer instead of grading when in question phase', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Cloze.md',
			['---', 'tags: [topic]', 'type: item', '---', '{{c1::alpha}}', ''].join('\n'),
		);
		const plugin = makePlugin(app);
		const leaf = new WorkspaceLeaf();
		const view = new ReviewItemView(leaf, app, plugin) as unknown as {
			onGrade: (grade: number) => Promise<void>;
			loadItemContent: () => Promise<void>;
			renderView: () => void;
			phase: 'question' | 'answer';
			currentItem: unknown;
		};

		view.currentItem = {
			id: 'note-1::uid-1',
			noteId: 'note-1',
			notePath: note.path,
			noteFile: note,
			type: 'item',
			clozeIndex: 1,
			state: makeState(),
			priority: 10,
		};
		view.phase = 'question';
		view.renderView = () => undefined;

		await withDocument(() => view.onGrade(3));
		expect(view.phase).toBe('answer');

		const reviews = await readAllReviews(app);
		expect(reviews).toHaveLength(0);
	});

	it('handles keyboard shortcuts', async () => {
		const app = new App();
		const note = await app.vault.create(
			'Notes/Topic.md',
			['---', 'tags: [topic]', 'type: item', '---', '{{c1::Body}}', ''].join('\n'),
		);
		const plugin = makePlugin(app);
		const leaf = new WorkspaceLeaf();
		const view = new ReviewItemView(leaf, app, plugin) as unknown as {
			onKeyDown: (event: KeyboardEvent) => void;
			backToSummary: () => Promise<void>;
			loadItemContent: () => Promise<void>;
			renderView: () => void;
			screen: string;
			phase: 'question' | 'answer';
			currentItem: unknown;
			queue: unknown;
		};

		view.renderView = () => undefined;
		view.currentItem = {
			id: 'note-1::uid-1',
			noteId: 'note-1',
			notePath: note.path,
			noteFile: note,
			type: 'item',
			clozeIndex: 1,
			state: makeState(),
			priority: 10,
		};
		view.queue = { learning: [], due: [], new: [] };
		view.screen = 'review';
		view.phase = 'question';

		await withDocument(() => {
			view.onKeyDown({
				key: 'Enter',
				defaultPrevented: false,
				preventDefault() {
					this.defaultPrevented = true;
				},
				target: null,
			} as unknown as KeyboardEvent);
		});
		expect(view.phase).toBe('answer');

		let escaped = false;
		view.backToSummary = async () => {
			view.screen = 'summary';
			escaped = true;
		};
		view.onKeyDown({
			key: 'Escape',
			defaultPrevented: false,
			preventDefault() {
				this.defaultPrevented = true;
			},
			target: null,
		} as unknown as KeyboardEvent);

		await Promise.resolve();
		expect(escaped).toBe(true);
		expect(view.screen).toBe('summary');

		view.screen = 'review';
		view.phase = 'answer';
		view.onKeyDown({
			key: '1',
			defaultPrevented: false,
			preventDefault() {
				this.defaultPrevented = true;
			},
			target: { tagName: 'INPUT' },
		} as unknown as KeyboardEvent);
		expect(view.phase).toBe('answer');
	});
});
