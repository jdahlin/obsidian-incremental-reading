import type { ReviewItem } from '@repo/core/core/types';
import type { App } from 'obsidian';
import { formatClozeAnswer, formatClozeQuestion, parseClozeIndices } from '@repo/core/core/cloze';
import { MarkdownRenderer, TFile } from 'obsidian';
import { syncNoteToSidecar } from '../data/sync';

export type ReviewPhase = 'question' | 'answer';

export interface ContentLoaderDeps {
	app: App;
	view: unknown;
	extractTag: string;
}

/**
 * Loads a review item's markdown content and returns rendered HTML.
 *
 * - Cloze items are rendered in question/answer format.
 * - Topic items render the full note.
 * - If a cloze index is missing from the sidecar, we try to re-sync first.
 */
export async function loadReviewItemHtml(
	deps: ContentLoaderDeps,
	item: ReviewItem | null,
	phase: ReviewPhase,
): Promise<string> {
	if (!item) return '';

	const file = item.noteFile ?? deps.app.vault.getAbstractFileByPath(item.notePath);
	if (!(file instanceof TFile)) return '';

	try {
		const rawContent = await deps.app.vault.read(file);

		// Cloze rendering
		if (item.type === 'item' && typeof item.clozeIndex === 'number' && item.clozeIndex !== 0) {
			const indices = parseClozeIndices(rawContent);
			if (!indices.includes(item.clozeIndex)) {
				await syncNoteToSidecar(deps.app, file, deps.extractTag);
			}

			const formatted =
				phase === 'question'
					? formatClozeQuestion(rawContent, item.clozeIndex)
					: formatClozeAnswer(rawContent, item.clozeIndex);

			return await renderMarkdownToHtml(deps.app, formatted, item.notePath, deps.view);
		}

		// Topic rendering
		return await renderMarkdownToHtml(deps.app, rawContent, item.notePath, deps.view);
	} catch (error) {
		console.error('IR: failed to load item content', error);
		return '<p>Failed to load content</p>';
	}
}

async function renderMarkdownToHtml(
	app: App,
	markdown: string,
	sourcePath: string,
	view: unknown,
): Promise<string> {
	const container = document.createElement('div');
	await MarkdownRenderer.render(app, markdown, container, sourcePath, view as never);
	const html = container.innerHTML;
	return html || container.textContent || '';
}
