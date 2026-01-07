import { App, TFile } from 'obsidian';
import type { ReviewRecord } from '../core/types';
import { formatDate } from '../core/frontmatter';

const REVLOG_FOLDER = 'IR/Revlog';

export async function appendReview(app: App, entry: ReviewRecord): Promise<void> {
	await ensureRevlogFolder(app);
	const ts = entry.ts ? new Date(entry.ts) : new Date();
	const path = revlogPathForDate(ts);
	const line = `${JSON.stringify({ ...entry, ts: entry.ts || formatDate(ts) })}\n`;
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.append(existing, line);
		return;
	}
	// Race condition: file may be created between check and create
	try {
		await app.vault.create(path, line);
	} catch {
		// File was created by another operation - append instead
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await app.vault.append(file, line);
		}
	}
}

export async function readReviewsSince(app: App, date: Date): Promise<ReviewRecord[]> {
	const files = await listRevlogFiles(app);
	const cutoff = date.getTime();
	const records: ReviewRecord[] = [];
	for (const file of files) {
		const content = await app.vault.read(file);
		for (const entry of parseJsonLines(content)) {
			const ts = new Date(entry.ts).getTime();
			if (Number.isNaN(ts) || ts < cutoff) continue;
			records.push(entry);
		}
	}
	return records;
}

export async function readReviewsForItem(app: App, itemId: string): Promise<ReviewRecord[]> {
	const files = await listRevlogFiles(app);
	const records: ReviewRecord[] = [];
	for (const file of files) {
		const content = await app.vault.read(file);
		for (const entry of parseJsonLines(content)) {
			if (entry.item_id === itemId) records.push(entry);
		}
	}
	return records;
}

export async function readAllReviews(app: App): Promise<ReviewRecord[]> {
	const files = await listRevlogFiles(app);
	const records: ReviewRecord[] = [];
	for (const file of files) {
		const content = await app.vault.read(file);
		records.push(...parseJsonLines(content));
	}
	return records;
}

export async function getReviewCount(app: App): Promise<number> {
	const files = await listRevlogFiles(app);
	let count = 0;
	for (const file of files) {
		const content = await app.vault.read(file);
		for (const line of content.split('\n')) {
			if (line.trim()) count += 1;
		}
	}
	return count;
}

function revlogPathForDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	return `${REVLOG_FOLDER}/${year}-${month}.md`;
}

async function ensureRevlogFolder(app: App): Promise<void> {
	// Ensure parent folder exists first
	const parent = app.vault.getAbstractFileByPath('IR');
	if (!parent) {
		try {
			await app.vault.createFolder('IR');
		} catch {
			// Already created by another operation
		}
	}
	// Then ensure revlog folder
	const folder = app.vault.getAbstractFileByPath(REVLOG_FOLDER);
	if (!folder) {
		try {
			await app.vault.createFolder(REVLOG_FOLDER);
		} catch {
			// Already created by another operation
		}
	}
}

async function listRevlogFiles(app: App): Promise<TFile[]> {
	const files = app.vault.getMarkdownFiles();
	return files.filter((file) => file.path.startsWith(`${REVLOG_FOLDER}/`));
}

function parseJsonLines(content: string): ReviewRecord[] {
	const records: ReviewRecord[] = [];
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			records.push(JSON.parse(trimmed) as ReviewRecord);
		} catch {
			continue;
		}
	}
	return records;
}
