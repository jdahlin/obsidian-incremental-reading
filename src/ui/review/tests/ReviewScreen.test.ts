import { describe, expect, it } from 'vitest';
import { ReviewScreen } from '../ReviewScreen';
import type { ReviewItem } from '../../../core/types';
import { formatClozeQuestion } from '../../../core/cloze';

function collectText(node: unknown, acc: string[] = []): string[] {
	if (node == null || typeof node === 'boolean') return acc;
	if (typeof node === 'string' || typeof node === 'number') {
		acc.push(String(node));
		return acc;
	}
	if (Array.isArray(node)) {
		for (const child of node) collectText(child, acc);
		return acc;
	}
	if (typeof node === 'object') {
		const props = (node as { props?: { children?: unknown } }).props;
		if (props && 'children' in props) {
			collectText(props.children, acc);
		}
	}
	return acc;
}

const baseProps = {
	selectedDeck: null,
	queueStats: { learning: 0, due: 0, new: 0, total: 0 },
	sessionStats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
	content: '<p>Test</p>',
	onBack: () => undefined,
	onShowAnswer: () => undefined,
	onGrade: () => undefined,
};

describe('ReviewScreen', () => {
	it('renders empty state when no item', () => {
		const vnode = ReviewScreen({
			...baseProps,
			currentItem: null,
			phase: 'question',
			sessionStats: { reviewed: 2, again: 1, hard: 0, good: 1, easy: 0 },
		});

		const text = collectText(vnode).join(' ');
		expect(text).toContain('Done!');
		expect(text).toContain('No more reviews for now.');
		expect(text).toContain('Back to decks');
	});

	it('renders question state for an item', () => {
		const item = {
			id: 'a',
			noteId: 'a',
			notePath: 'a',
			type: 'topic',
			priority: 0,
			state: {
				status: 'new',
				due: null,
				stability: 0,
				difficulty: 0,
				reps: 0,
				lapses: 0,
				last_review: null,
			},
		} satisfies ReviewItem;

		const vnode = ReviewScreen({
			...baseProps,
			currentItem: item,
			phase: 'question',
		});

		const text = collectText(vnode).join(' ');
		expect(text).toContain('Show Answer');
	});

	it('renders grading buttons for answer phase', () => {
		const item = {
			id: 'a',
			noteId: 'a',
			notePath: 'a',
			type: 'topic',
			priority: 0,
			state: {
				status: 'new',
				due: null,
				stability: 0,
				difficulty: 0,
				reps: 0,
				lapses: 0,
				last_review: null,
			},
		} satisfies ReviewItem;

		const vnode = ReviewScreen({
			...baseProps,
			currentItem: item,
			phase: 'answer',
		});

		const text = collectText(vnode).join(' ');
		expect(text).toContain('1');
		expect(text).toContain('2');
		expect(text).toContain('3');
		expect(text).toContain('4');
	});

	it('hides cloze answer in question phase', () => {
		// This test verifies that when a cloze item is displayed in question phase,
		// the cloze answer text should be replaced with [...] placeholder.
		// The ReviewScreen receives pre-formatted content, so we test that:
		// 1. Properly formatted content (using formatClozeQuestion) shows [...]
		// 2. The raw cloze answer "Paris" is NOT visible in the formatted output

		const rawMarkdown = 'The capital of France is {{c1::Paris}}.';
		const formattedContent = formatClozeQuestion(rawMarkdown, 1);

		// Verify the formatting itself works correctly
		expect(formattedContent).toContain('[...]');
		expect(formattedContent).not.toContain('Paris');
		expect(formattedContent).not.toContain('{{c1::');

		// Now test that the ReviewScreen would render this content
		const item = {
			id: 'cloze-1',
			noteId: 'note-1',
			notePath: 'notes/test.md',
			type: 'item',
			clozeIndex: 1,
			priority: 0,
			state: {
				status: 'new',
				due: null,
				stability: 0,
				difficulty: 0,
				reps: 0,
				lapses: 0,
				last_review: null,
			},
		} satisfies ReviewItem;

		const vnode = ReviewScreen({
			...baseProps,
			currentItem: item,
			phase: 'question',
			content: `<p>${formattedContent}</p>`,
		});

		// The content prop should be passed through to dangerouslySetInnerHTML
		// We verify the vnode structure contains our formatted content
		const cardDiv = (vnode as { props: { children: unknown[] } }).props.children[0];
		const innerDiv = (cardDiv as { props: { children: unknown } }).props.children;
		const htmlContent = (innerDiv as { props: { dangerouslySetInnerHTML: { __html: string } } })
			.props.dangerouslySetInnerHTML.__html;

		expect(htmlContent).toContain('[...]');
		expect(htmlContent).not.toContain('Paris');
	});

	it('should not display raw cloze syntax in question phase', () => {
		// This test catches the bug where cloze content is passed through
		// WITHOUT proper formatting, causing the raw cloze answer to be visible.
		// If this test fails, it means the cloze answer is being shown to the user.

		const rawClozeContent = '<p>The capital of France is {{c1::Paris}}.</p>';

		const item = {
			id: 'cloze-1',
			noteId: 'note-1',
			notePath: 'notes/test.md',
			type: 'item',
			clozeIndex: 1,
			priority: 0,
			state: {
				status: 'new',
				due: null,
				stability: 0,
				difficulty: 0,
				reps: 0,
				lapses: 0,
				last_review: null,
			},
		} satisfies ReviewItem;

		const vnode = ReviewScreen({
			...baseProps,
			currentItem: item,
			phase: 'question',
			content: rawClozeContent,
		});

		// Get the HTML content that would be rendered
		const cardDiv = (vnode as { props: { children: unknown[] } }).props.children[0];
		const innerDiv = (cardDiv as { props: { children: unknown } }).props.children;
		const htmlContent = (innerDiv as { props: { dangerouslySetInnerHTML: { __html: string } } })
			.props.dangerouslySetInnerHTML.__html;

		// The raw cloze answer "Paris" should NOT be visible in question phase
		// This assertion will FAIL if content is passed without formatting
		expect(htmlContent).not.toContain('Paris');
		expect(htmlContent).not.toContain('{{c1::');
	});
});
