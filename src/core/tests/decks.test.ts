import { describe, expect, it } from 'vitest';
import { buildDeckTree, getCountsForFolder, getFolderPath } from '../decks';
import type { ReviewItem } from '../types';

const now = new Date('2024-01-02T10:00:00');

function makeItem(partial: Partial<ReviewItem>): ReviewItem {
	return {
		id: partial.id ?? 'id',
		noteId: partial.noteId ?? 'note',
		notePath: partial.notePath ?? 'Folder/Note.md',
		type: partial.type ?? 'topic',
		clozeIndex: partial.clozeIndex ?? null,
		state: partial.state ?? {
			status: 'new',
			due: now,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			last_review: null,
		},
		priority: partial.priority ?? 50,
		created: partial.created ?? new Date('2024-01-01T00:00:00'),
	};
}

describe('deck helpers', () => {
	it('returns folder path for notes', () => {
		expect(getFolderPath('A/B/Note.md')).toBe('A/B');
		expect(getFolderPath('Note.md')).toBe('');
	});

	it('computes counts for a folder', () => {
		const items = [
			makeItem({
				notePath: 'A/One.md',
				state: {
					status: 'new',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
			makeItem({
				notePath: 'A/B/Two.md',
				state: {
					status: 'learning',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
			makeItem({
				notePath: 'A/B/Three.md',
				state: {
					status: 'review',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
			makeItem({
				notePath: 'C/Four.md',
				state: {
					status: 'review',
					due: new Date('2024-01-03T00:00:00'),
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
		];

		const counts = getCountsForFolder(items, 'A', now);
		expect(counts).toEqual({ new: 1, learning: 1, due: 1 });
	});

	it('builds a deck tree for nested folders', () => {
		const items = [
			makeItem({
				notePath: 'A/One.md',
				state: {
					status: 'new',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
			makeItem({
				notePath: 'A/B/Two.md',
				state: {
					status: 'learning',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
			makeItem({
				notePath: 'C/Three.md',
				state: {
					status: 'review',
					due: now,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
					last_review: null,
				},
			}),
		];

		const tree = buildDeckTree(items, now);
		const rootPaths = tree.map((node) => node.path).sort();
		expect(rootPaths).toEqual(['A', 'C']);

		const aNode = tree.find((node) => node.path === 'A');
		expect(aNode?.children.map((child) => child.path)).toEqual(['A/B']);
	});
});
