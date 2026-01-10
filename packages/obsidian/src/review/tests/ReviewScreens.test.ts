import { describe, expect, it } from 'vitest';
import { ReviewAnswerScreen } from '../ReviewAnswerScreen';
import { ReviewFinishedScreen } from '../ReviewFinishedScreen';
import { ReviewQuestionScreen } from '../ReviewQuestionScreen';

type ComponentFn = (props: Record<string, unknown>) => unknown;

interface VNodeLike {
	type?: ComponentFn | string;
	props?: Record<string, unknown> & {
		children?: unknown;
		dangerouslySetInnerHTML?: { __html: string };
	};
}

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
		const vnode = node as VNodeLike;
		const component = vnode.type;
		if (typeof component === 'function') {
			return collectText(component(vnode.props ?? {}), acc);
		}
		if (vnode.props && 'children' in vnode.props) {
			collectText(vnode.props.children, acc);
		}
	}
	return acc;
}

function collectTextNormalized(node: unknown): string {
	return collectText(node).join(' ').replace(/\s+/g, ' ').trim();
}

function findHtmlContent(node: unknown): string | null {
	if (node == null || typeof node === 'boolean') return null;
	if (Array.isArray(node)) {
		for (const child of node) {
			const result = findHtmlContent(child);
			if (result) return result;
		}
		return null;
	}
	if (typeof node === 'object') {
		const vnode = node as VNodeLike;
		const component = vnode.type;
		if (typeof component === 'function') {
			return findHtmlContent(component(vnode.props ?? {}));
		}
		if (vnode.props?.dangerouslySetInnerHTML?.__html) {
			return vnode.props.dangerouslySetInnerHTML.__html;
		}
		if (vnode.props && 'children' in vnode.props) {
			return findHtmlContent(vnode.props.children);
		}
	}
	return null;
}

function getHtmlContent(node: unknown): string {
	const html = findHtmlContent(node);
	if (html == null) {
		throw new Error('Expected review content to contain HTML.');
	}
	return html;
}

const mockDebugInfo = {
	queue: 'new',
	status: 'new',
	priority: 50,
	due: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
};

describe('review screens', () => {
	it('renders finished screen with session summary', () => {
		const vnode = ReviewFinishedScreen({
			sessionStats: { reviewed: 2, again: 1, hard: 0, good: 1, easy: 0 },
			onBack: () => undefined,
		});

		const text = collectTextNormalized(vnode);
		expect(text).toContain('Done!');
		expect(text).toContain('No more reviews for now.');
		expect(text).toContain('Back to decks');
		expect(text).toContain('Reviewed: 2');
	});

	it('renders question screen with show answer', () => {
		const vnode = ReviewQuestionScreen({
			content: '<p>Test</p>',
			clozeIndex: null,
			debugInfo: mockDebugInfo,
			onShowAnswer: () => undefined,
		});

		const text = collectTextNormalized(vnode);
		expect(text).toContain('Show Answer');
	});

	it('renders answer screen with grading buttons', () => {
		const vnode = ReviewAnswerScreen({
			content: '<p>Test</p>',
			debugInfo: mockDebugInfo,
			onGrade: () => undefined,
		});

		const text = collectTextNormalized(vnode);
		expect(text).toContain('1');
		expect(text).toContain('2');
		expect(text).toContain('3');
		expect(text).toContain('4');
	});

	it('hides cloze answer in question screen', () => {
		const rawClozeContent = '<p>The capital of France is {{c1::Paris}}.</p>';

		const vnode = ReviewQuestionScreen({
			content: rawClozeContent,
			clozeIndex: 1,
			debugInfo: mockDebugInfo,
			onShowAnswer: () => undefined,
		});

		const htmlContent = getHtmlContent(vnode);
		expect(htmlContent).toContain('[...]');
		expect(htmlContent).not.toContain('Paris');
		expect(htmlContent).not.toContain('{{c1::');
	});
});
