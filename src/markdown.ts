import { MarkdownRenderer, type App, type Component } from 'obsidian';

type MarkdownRendererCompat = {
	render?: (
		app: App,
		markdown: string,
		containerEl: HTMLElement,
		sourcePath: string,
		component: Component,
	) => Promise<void> | void;
	renderMarkdown?: (
		markdown: string,
		containerEl: HTMLElement,
		sourcePath: string,
		component: Component,
	) => Promise<void> | void;
};

/**
 * Render markdown into an HTMLElement using Obsidian's renderer.
 *
 * This produces rendered HTML (like reading view) inside `containerEl`.
 */
export async function renderMarkdownToEl(
	app: App,
	markdown: string,
	containerEl: HTMLElement,
	sourcePath: string,
	component: Component,
): Promise<void> {
	containerEl.empty();

	const mr = MarkdownRenderer as unknown as MarkdownRendererCompat;
	if (typeof mr.render === 'function') {
		await mr.render(app, markdown, containerEl, sourcePath, component);
		return;
	}

	// Compatibility for older Obsidian versions.
	if (typeof mr.renderMarkdown === 'function') {
		await mr.renderMarkdown(markdown, containerEl, sourcePath, component);
		return;
	}

	// Ultimate fallback.
	containerEl.createEl('pre', { text: markdown });
}
