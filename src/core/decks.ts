import type { DeckInfo, ReviewItem } from './types';

export function buildDeckTree(items: ReviewItem[], now: Date): DeckInfo[] {
	const paths = new Set<string>();
	for (const item of items) {
		let folder = getFolderPath(item.notePath);
		if (!folder) folder = '/';

		if (folder === '/') {
			paths.add('/');
		} else {
			const segments = folder.split('/');
			for (let i = 1; i <= segments.length; i += 1) {
				paths.add(segments.slice(0, i).join('/'));
			}
		}
	}

	const nodes = new Map<string, DeckInfo>();
	for (const path of paths) {
		const segments = path.split('/');
		let name = segments[segments.length - 1] || path;
		let depth = Math.max(0, segments.length - 1);

		if (path === '/') {
			name = '/';
			depth = 0;
		}

		const counts = getCountsForFolder(items, path, now);
		nodes.set(path, {
			path,
			name,
			depth,
			counts,
			children: [],
			collapsed: false,
		});
	}

	const roots: DeckInfo[] = [];
	for (const [path, node] of nodes) {
		const parentPath = getParentPath(path);
		if (parentPath && nodes.has(parentPath)) {
			nodes.get(parentPath)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	for (const node of nodes.values()) {
		node.children.sort((a, b) => a.name.localeCompare(b.name));
	}
	roots.sort((a, b) => a.name.localeCompare(b.name));

	return roots;
}

export function getCountsForFolder(
	items: ReviewItem[],
	folderPath: string,
	now: Date,
): { new: number; learning: number; due: number } {
	const filtered = filterByFolder(items, folderPath);
	const categorized = categorizeItems(filtered, now);
	return {
		new: categorized.new.length,
		learning: categorized.learning.length,
		due: categorized.due.length,
	};
}

export function getFolderPath(notePath: string): string {
	const segments = notePath.split('/');
	if (segments.length <= 1) return '';
	return segments.slice(0, -1).join('/');
}

function getParentPath(path: string): string {
	const segments = path.split('/');
	if (segments.length <= 1) return '';
	return segments.slice(0, -1).join('/');
}

function filterByFolder(items: ReviewItem[], folderPath: string): ReviewItem[] {
	if (!folderPath || folderPath === '') {
		return items;
	}
	if (folderPath === '/') {
		return items.filter((item) => !item.notePath.includes('/'));
	}
	const normalized = folderPath.replace(/\/$/, '');
	return items.filter(
		(item) => item.notePath === normalized || item.notePath.startsWith(`${normalized}/`),
	);
}

interface CategorizedItems {
	learning: ReviewItem[];
	due: ReviewItem[];
	new: ReviewItem[];
	upcoming: ReviewItem[];
}

function categorizeItems(items: ReviewItem[], now: Date): CategorizedItems {
	const learning: ReviewItem[] = [];
	const due: ReviewItem[] = [];
	const newItems: ReviewItem[] = [];
	const upcoming: ReviewItem[] = [];

	for (const item of items) {
		const status = item.state.status;
		const dueDate = item.state.due;

		if (status === 'new') {
			newItems.push(item);
		} else if (status === 'learning' || status === 'relearning') {
			if (!dueDate || dueDate <= now) {
				learning.push(item);
			} else {
				upcoming.push(item);
			}
		} else if (!dueDate || dueDate <= now) {
			due.push(item);
		} else {
			upcoming.push(item);
		}
	}

	return { learning, due, new: newItems, upcoming };
}
