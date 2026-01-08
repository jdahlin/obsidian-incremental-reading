import { describe, expect, it } from 'vitest';
import { ReviewScreen } from '../../src/views/review/ReviewScreen';
import type { ReviewItem } from '../../src/core/types';

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
});
