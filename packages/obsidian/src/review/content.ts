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
 * - Basic items show Front on question, Front+Back on answer.
 * - Image occlusion items show the image (mask handling TBD).
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

		// Basic card rendering (front/back)
		if (item.type === 'basic') {
			const formatted = formatBasicCard(rawContent, phase);
			return await renderMarkdownToHtml(deps.app, formatted, item.notePath, deps.view);
		}

		// Image occlusion rendering (for now, show full content)
		// TODO: Implement mask toggling based on phase
		if (item.type === 'image_occlusion') {
			return await renderMarkdownToHtml(deps.app, rawContent, item.notePath, deps.view);
		}

		// Topic rendering (full note)
		return await renderMarkdownToHtml(deps.app, rawContent, item.notePath, deps.view);
	} catch (error) {
		console.error('IR: failed to load item content', error);
		return '<p>Failed to load content</p>';
	}
}

/**
 * Format basic card content for question/answer phase.
 * Looks for ## Front and ## Back sections, or falls back to showing all content.
 */
function formatBasicCard(content: string, phase: ReviewPhase): string {
	// Extract section content by finding the header and taking content until next header or end
	const front = extractSection(content, 'Front');
	const back = extractSection(content, 'Back');

	if (front !== null) {
		if (phase === 'question') {
			return front;
		}
		// Answer phase: show both front and back
		return back ? `${front}\n\n---\n\n${back}` : front;
	}

	// Fallback: no Front/Back sections found, show full content
	return content;
}

/**
 * Extract content from a markdown section (## SectionName).
 */
function extractSection(content: string, sectionName: string): string | null {
	const headerPattern = new RegExp(`^## ${sectionName}\\s*$`, 'm');
	const headerMatch = headerPattern.exec(content);
	if (headerMatch === null) return null;

	const startIndex = headerMatch.index + headerMatch[0].length;
	const remainingContent = content.slice(startIndex);

	// Find the next ## header or end of content
	const nextHeaderMatch = /^## /m.exec(remainingContent);
	const sectionContent = nextHeaderMatch
		? remainingContent.slice(0, nextHeaderMatch.index)
		: remainingContent;

	return sectionContent.trim();
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
