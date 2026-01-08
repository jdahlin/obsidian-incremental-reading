import { describe, expect, it } from 'vitest';
import { DeckSummary } from '../../src/ui/review/DeckSummary';
import type { DeckInfo } from '../../src/core/types';

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

function makeDeck(
	path: string,
	name: string,
	depth: number,
	counts: { new: number; learning: number; due: number },
	children: DeckInfo[] = [],
): DeckInfo {
	return { path, name, depth, counts, children, collapsed: false };
}

describe('DeckSummary', () => {
	it('renders deck counts and optional streak', () => {
		const decks = [
			makeDeck('A', 'A', 0, { new: 1, learning: 2, due: 3 }, [
				makeDeck('A/B', 'B', 1, { new: 0, learning: 1, due: 0 }),
			]),
		];

		const vnode = DeckSummary({
			decks,
			selectedPath: null,
			allCounts: { new: 2, learning: 3, due: 4 },
			todayStats: { reviewed: 5, again: 1, hard: 1, good: 2, easy: 1 },
			streak: { current: 7, longest: 10 },
			showStreak: true,
			onSelect: () => undefined,
			onStudy: () => undefined,
			onStats: () => undefined,
		});

		const text = collectText(vnode).join(' ').replace(/\s+/g, ' ').trim();
		expect(text).toContain('Decks');
		expect(text).toContain('All decks');
		expect(text).toContain('Today: 5 reviewed');
		expect(text).toContain('Streak: 7 days');
	});

	it('hides streak when disabled', () => {
		const vnode = DeckSummary({
			decks: [],
			selectedPath: null,
			allCounts: { new: 0, learning: 0, due: 0 },
			todayStats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
			streak: { current: 0, longest: 0 },
			showStreak: false,
			onSelect: () => undefined,
			onStudy: () => undefined,
			onStats: () => undefined,
		});

		const text = collectText(vnode).join(' ').replace(/\s+/g, ' ').trim();
		expect(text).not.toContain('Streak:');
	});
});
