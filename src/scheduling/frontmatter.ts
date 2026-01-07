import { App, TFile } from 'obsidian';
import type { CardState, CardType, Status } from './types';

const DEFAULT_EXTRACT_TAG = 'topic';

export async function readCardState(app: App, file: TFile, extractTag = DEFAULT_EXTRACT_TAG): Promise<CardState | null> {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ?? {};

	if (!hasExtractTag(fm.tags, extractTag)) return null;

	const created = parseDate(fm.created) ?? new Date(file.stat.ctime);
	const due = parseDate(fm.due) ?? created;
	const lastReview = parseDate(fm.last_review);
	const type = normalizeType(fm.type);

	return {
		source: typeof fm.source === 'string' ? fm.source : '',
		type,
		created,
		due,
		status: normalizeStatus(fm.status),
		priority: normalizeNumber(fm.priority, 50),
		last_review: lastReview,
		stability: normalizeNumber(fm.stability, 0),
		difficulty: normalizeNumber(fm.difficulty, 0),
		reps: normalizeNumber(fm.reps, 0),
		lapses: normalizeNumber(fm.lapses, 0),
		scroll_pos: normalizeNumber(fm.scroll_pos, 0),
	};
}

export async function writeCardState(app: App, file: TFile, state: CardState, extractTag = DEFAULT_EXTRACT_TAG): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		fm.source = state.source;
		fm.tags = ensureTag(fm.tags, extractTag);
		fm.type = state.type;
		fm.created = formatDate(state.created);
		fm.due = formatDate(state.due);
		fm.status = state.status;
		fm.priority = state.priority;
		fm.stability = state.stability;
		fm.difficulty = state.difficulty;
		fm.reps = state.reps;
		fm.lapses = state.lapses;
		fm.last_review = state.last_review ? formatDate(state.last_review) : '';
		fm.scroll_pos = state.scroll_pos;
	});
}

export async function initializeCardState(app: App, file: TFile, extractTag = DEFAULT_EXTRACT_TAG): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (!hasExtractTag(fm.tags, extractTag)) return;

		fm.type = normalizeType(fm.type);
		fm.created = fm.created ?? formatDate(new Date(file.stat.ctime));
		fm.due = fm.due ?? fm.created;
		fm.status = normalizeStatus(fm.status);
		fm.priority = normalizeNumber(fm.priority, 50);
		fm.stability = normalizeNumber(fm.stability, 0);
		fm.difficulty = normalizeNumber(fm.difficulty, 0);
		fm.reps = normalizeNumber(fm.reps, 0);
		fm.lapses = normalizeNumber(fm.lapses, 0);
		fm.last_review = fm.last_review ?? '';
		fm.scroll_pos = normalizeNumber(fm.scroll_pos, 0);
	});
}

function hasExtractTag(tags: unknown, extractTag: string): boolean {
	return normalizeTags(tags).includes(extractTag);
}

function ensureTag(tags: unknown, tag: string): string[] {
	const normalized = normalizeTags(tags);
	if (!normalized.includes(tag)) normalized.push(tag);
	return normalized;
}

export function normalizeTags(tags: unknown): string[] {
	if (Array.isArray(tags)) {
		return tags.map((t) => String(t).replace(/^#/, '')).filter(Boolean);
	}
	if (typeof tags === 'string') {
		return tags.split(/[,\s]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
	}
	return [];
}

export function normalizeType(value: unknown): CardType {
	return value === 'item' ? 'item' : 'topic';
}

export function normalizeStatus(value: unknown): Status {
	switch (value) {
		case 'learning':
		case 'review':
		case 'relearning':
		case 'new':
			return value;
		default:
			return 'new';
	}
}

export function normalizeNumber(value: unknown, fallback: number): number {
	const num = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(num) ? num : fallback;
}

export function parseDate(value: unknown): Date | null {
	if (value instanceof Date) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return null;
}

export function formatDate(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	const hours = String(value.getHours()).padStart(2, '0');
	const minutes = String(value.getMinutes()).padStart(2, '0');
	const seconds = String(value.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
