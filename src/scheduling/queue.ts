import type { App, TFile } from 'obsidian';
import { getNotesWithTag } from '../search';
import { readCardState } from './frontmatter';
import type { CardState } from './types';

export interface QueueEntry {
	file: TFile;
	state: CardState;
}

export interface ReviewQueue {
	learning: QueueEntry[];
	due: QueueEntry[];
	new: QueueEntry[];
	nextDue: Date | null;
	upcomingCount: number;
}

export interface QueueStats {
	learning: number;
	due: number;
	new: number;
	total: number;
}

export async function buildQueue(app: App, now: Date, extractTag = 'extract'): Promise<ReviewQueue> {
	const extracts = getNotesWithTag(app, `#${extractTag}`);
	const queue: ReviewQueue = { learning: [], due: [], new: [], nextDue: null, upcomingCount: 0 };

	for (const file of extracts) {
		const state = await readCardState(app, file, extractTag);
		if (!state) continue;

		const entry = { file, state };
		if (state.due > now) {
			queue.upcomingCount += 1;
			if (!queue.nextDue || state.due < queue.nextDue) {
				queue.nextDue = state.due;
			}
		}
		switch (state.status) {
			case 'new':
				queue.new.push(entry);
				break;
			case 'learning':
			case 'relearning':
				if (state.due <= now) queue.learning.push(entry);
				break;
			case 'review':
				if (state.due <= now) queue.due.push(entry);
				break;
		}
	}

	queue.learning.sort((a, b) => a.state.due.getTime() - b.state.due.getTime());

	queue.due.sort((a, b) =>
		a.state.priority - b.state.priority ||
		a.state.due.getTime() - b.state.due.getTime()
	);

	queue.new.sort((a, b) =>
		a.state.priority - b.state.priority ||
		a.state.created.getTime() - b.state.created.getTime()
	);

	return queue;
}

export function getNextCard(queue: ReviewQueue): QueueEntry | null {
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
