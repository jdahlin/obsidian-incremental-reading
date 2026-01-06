import './cloze.css';
import { Editor, Notice } from 'obsidian';

export type ClozeOptions = {
	/** Optional label shown next to the cloze, default is "..." */
	title?: string;
	/** Cloze index for Anki-style syntax, defaults to 1 */
	index?: number;
};

/**
 * Wrap the current selection in a cloze marker.
 *
 * Output format:
 * <span class="ir-cloze" data-cloze="c1" data-title="...">{{c1::selected::...}}</span>
 */
export function clozeSelection(editor: Editor, options: ClozeOptions = {}): void {
	const selectionRaw = editor.getSelection();
	if (!selectionRaw.trim()) {
		new Notice('No selection to cloze.');
		return;
	}

	const index = options.index ?? 1;

	// Keep Anki cloze syntax but wrap it in a span so we can style/hide via CSS.
	const clozeText = `{{c${index}::${selectionRaw}}}`;
	const html = `<span class="ir-cloze" data-cloze="c${index}">${escapeHtmlText(clozeText)}</span>`;

	editor.replaceSelection(html);
}

function escapeHtmlText(value: string): string {
	// We want the literal cloze braces to render as text, not parsed HTML.
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
