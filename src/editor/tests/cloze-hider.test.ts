import { describe, expect, it } from 'vitest';
import { App, MarkdownView } from 'obsidian';
import { setActiveCloze } from '../cloze-hider';

describe('cloze hider', () => {
	it('does nothing without an active markdown view', () => {
		const app = new App();
		setActiveCloze(app, 1, 'question');
		setActiveCloze(app, null, 'answer');
		expect(true).toBe(true);
	});

	it('dispatches cloze state to the editor when available', () => {
		const app = new App();
		const markdownView = new MarkdownView();
		let dispatched = false;
		markdownView.editor = {
			cm: {
				dispatch: (_payload: unknown) => {
					dispatched = true;
				},
			},
		};
		app.workspace.setActiveView(markdownView);

		setActiveCloze(app, 2, 'question');
		expect(dispatched).toBe(true);
	});
});
