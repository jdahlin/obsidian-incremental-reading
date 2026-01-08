import type { ReviewItem, ReviewQueue, ReviewQueueOptions, QueueStats } from './types';

export function filterByFolder(items: ReviewItem[], folderPath?: string | null): ReviewItem[] {
	if (!folderPath) return items;

	if (folderPath === '/') {
		return items.filter((item) => !item.notePath.includes('/'));
	}

	const normalized = folderPath.replace(/\/$/, '');
	return items.filter((item) => {
		if (item.notePath === normalized) return true;
		return item.notePath.startsWith(`${normalized}/`);
	});
}

export function categorizeItems(items: ReviewItem[], now: Date): ReviewQueue {
	const learning: ReviewItem[] = [];
	const due: ReviewItem[] = [];
	const fresh: ReviewItem[] = [];
	const upcoming: ReviewItem[] = [];

	for (const item of items) {
		const dueDate = item.state.due;
		if (item.state.status === 'new') {
			fresh.push(item);
			continue;
		}

		if (dueDate && dueDate <= now) {
			if (item.state.status === 'learning' || item.state.status === 'relearning') {
				learning.push(item);
			} else {
				due.push(item);
			}
		} else {
			upcoming.push(item);
		}
	}

	return { learning, due, new: fresh, upcoming };
}

export function sortByPriority(
	items: ReviewItem[],
	tiebreaker?: (a: ReviewItem, b: ReviewItem) => number,
): ReviewItem[] {
	return items.slice().sort((a, b) => {
		const priorityDiff = a.priority - b.priority;
		if (priorityDiff !== 0) return priorityDiff;
		if (tiebreaker) return tiebreaker(a, b);
		return 0;
	});
}

export function buildQueue(
	items: ReviewItem[],
	now: Date,
	options: ReviewQueueOptions,
): ReviewQueue {
	const filtered = filterByFolder(items, options.folderFilter);
	const categorized = categorizeItems(filtered, now);

	const byType = (a: ReviewItem, b: ReviewItem): number => {
		if (a.type === b.type) return 0;
		return a.type === 'item' ? -1 : 1;
	};

	const byDueDate = (a: ReviewItem, b: ReviewItem): number => {
		const typeDiff = byType(a, b);
		if (typeDiff !== 0) return typeDiff;
		const aDue = a.state.due?.getTime() ?? Number.POSITIVE_INFINITY;
		const bDue = b.state.due?.getTime() ?? Number.POSITIVE_INFINITY;
		return aDue - bDue;
	};

	const byCreated = (a: ReviewItem, b: ReviewItem): number => {
		const typeDiff = byType(a, b);
		if (typeDiff !== 0) return typeDiff;
		const aCreated = a.created?.getTime() ?? 0;
		const bCreated = b.created?.getTime() ?? 0;
		return aCreated - bCreated;
	};

	const learning = categorized.learning.slice().sort(byDueDate);
	const due = sortByPriority(categorized.due, byDueDate);
	const fresh = sortByPriority(categorized.new, byCreated).slice(0, options.newCardsLimit);
	const upcoming = categorized.upcoming.slice().sort(byDueDate);

	return {
		learning,
		due,
		new: fresh,
		upcoming,
	};
}

export function getNextItem(queue: ReviewQueue): ReviewItem | null {
	return queue.learning[0] ?? queue.due[0] ?? queue.new[0] ?? null;
}

export function getQueueStats(queue: ReviewQueue): QueueStats {
	const learning = queue.learning.length;
	const due = queue.due.length;
	const fresh = queue.new.length;
	return {
		learning,
		due,
		new: fresh,
		total: learning + due + fresh,
	};
}
