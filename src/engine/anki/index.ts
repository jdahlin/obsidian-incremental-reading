/* eslint-disable import/no-nodejs-modules, no-console */
/**
 * Anki importer public API.
 * Imports Anki SQLite database into IR markdown format.
 */

import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { readAnkiDatabase } from './reader.js';
import { convertAnkiToIR, type ImportOptions, type ImportResult } from './converter.js';
import { copyMediaFiles, getDefaultAnkiPath } from './media.js';
import { rewriteMediaPaths } from './html.js';
import type { AnkiRevlog } from './schema.js';
import type { ReviewRecord, Rating, ReviewState } from '../types.js';

export { type ImportOptions, type ImportResult, type ImportedNote } from './converter.js';
export { getDefaultAnkiPath } from './media.js';

export interface AnkiImportConfig {
	/** Path to Anki profile folder (contains collection.anki2) */
	ankiProfilePath?: string;
	/** Path to target Obsidian vault */
	vaultPath: string;
	/** Deck name filter pattern (e.g., "ANATOMI*") */
	deckFilter?: string;
	/** Skip suspended cards (default: true) */
	skipSuspended?: boolean;
	/** Tag to add to imported notes (default: "anki-import") */
	tag?: string;
	/** Subfolder within vault for imported notes (default: "Anki") */
	importFolder?: string;
}

export interface AnkiImportResult {
	notesImported: number;
	mediaFilesCopied: number;
	mediaMissing: string[];
	reviewsImported: number;
	reviewsSkipped: number;
	stats: ImportResult['stats'];
}

/**
 * Import Anki database into Obsidian vault.
 */
export async function importAnkiDatabase(config: AnkiImportConfig): Promise<AnkiImportResult> {
	const {
		ankiProfilePath = getDefaultAnkiPath(),
		vaultPath,
		deckFilter,
		skipSuspended = true,
		tag = 'anki-import',
		importFolder = 'Anki',
	} = config;

	const dbPath = join(ankiProfilePath, 'collection.anki2');
	if (!existsSync(dbPath)) {
		throw new Error(`Anki database not found at: ${dbPath}`);
	}

	// 1. Read Anki database (including revlog for stats)
	console.log(`Reading Anki database from ${dbPath}...`);
	const ankiData = readAnkiDatabase(dbPath, true); // includeRevlog=true
	console.log(
		`Found ${ankiData.notes.length} notes, ${ankiData.cards.length} cards, ${ankiData.decks.size} decks`,
	);
	if (ankiData.revlog) {
		console.log(`Found ${ankiData.revlog.length} review log entries`);
	}

	// 2. Convert to IR format
	console.log('Converting to IR format...');
	const importOptions: ImportOptions = {
		deckFilter,
		skipSuspended,
		tag,
	};
	const result = convertAnkiToIR(ankiData, importOptions);
	console.log(
		`Converted ${result.stats.total} notes (${result.stats.cloze} cloze, ${result.stats.basic} basic, ${result.stats.skipped} skipped)`,
	);

	// 3. Copy media files
	console.log(`Copying ${result.allMediaRefs.size} media files...`);
	const { copied: mediaPathMap, missing: mediaMissing } = copyMediaFiles(
		ankiProfilePath,
		vaultPath,
		result.allMediaRefs,
	);
	console.log(`Copied ${mediaPathMap.size} files, ${mediaMissing.length} missing`);

	// 4. Write markdown files (using Anki note ID as filename for uniqueness)
	console.log('Writing markdown files...');
	for (const note of result.notes) {
		const content = rewriteMediaPaths(note.content, mediaPathMap);
		const notePath = join(vaultPath, importFolder, note.deckPath, `${note.filename}.md`);

		// Ensure directory exists
		const noteDir = join(vaultPath, importFolder, note.deckPath);
		if (!existsSync(noteDir)) {
			mkdirSync(noteDir, { recursive: true });
		}

		writeFileSync(notePath, content, 'utf-8');
	}

	// 5. Write sidecar files to IR/Review Items/
	console.log('Writing sidecar files...');
	const sidecarDir = join(vaultPath, 'IR', 'Review Items');
	if (!existsSync(sidecarDir)) {
		mkdirSync(sidecarDir, { recursive: true });
	}

	for (const note of result.notes) {
		const sidecarContent = buildSidecarContent(note);
		const sidecarPath = join(sidecarDir, `${note.id}.md`);
		writeFileSync(sidecarPath, sidecarContent, 'utf-8');
	}

	// 6. Write revlog entries to IR/Revlog/
	let reviewsImported = 0;
	let reviewsSkipped = 0;
	if (ankiData.revlog && ankiData.revlog.length > 0) {
		console.log(`Converting ${ankiData.revlog.length} review log entries...`);
		const { imported, skipped } = writeRevlogEntries(
			vaultPath,
			ankiData.revlog,
			result.cardIdMap,
		);
		reviewsImported = imported;
		reviewsSkipped = skipped;
		console.log(`Imported ${reviewsImported} reviews, skipped ${reviewsSkipped}`);
	}

	console.log('Import complete!');

	return {
		notesImported: result.stats.total,
		mediaFilesCopied: mediaPathMap.size,
		mediaMissing,
		reviewsImported,
		reviewsSkipped,
		stats: result.stats,
	};
}

/**
 * Build sidecar file content for IR scheduling.
 */
function buildSidecarContent(note: {
	id: string;
	deckPath: string;
	filename: string;
	type: 'topic' | 'item';
	cards: Array<{ clozeIndex?: number; state: import('../types.js').ReviewState }>;
}): string {
	const notePath = `Anki/${note.deckPath}/${note.filename}.md`;

	const data: Record<string, unknown> = {
		ir_note_id: note.id,
		note_path: notePath,
		type: note.type,
		priority: 50,
	};

	// For cloze notes, add cloze entries
	if (note.type === 'item' && note.cards.some((c) => c.clozeIndex)) {
		data.cloze = note.cards.filter((c) => c.clozeIndex).map((c) => `c${c.clozeIndex}`);

		const clozes: Record<string, unknown> = {};
		for (const card of note.cards) {
			if (!card.clozeIndex) continue;
			const key = `c${card.clozeIndex}`;
			clozes[key] = {
				cloze_uid: generateClozeUid(),
				...serializeState(card.state),
			};
		}
		data.clozes = clozes;
	} else {
		// Topic scheduling
		const firstCard = note.cards[0];
		if (firstCard) {
			data.topic = serializeState(firstCard.state);
		}
	}

	return `---\n${yamlStringify(data)}---\n`;
}

function serializeState(state: import('../types.js').ReviewState): Record<string, unknown> {
	return {
		status: state.status,
		due: state.due?.toISOString() ?? null,
		stability: state.stability,
		difficulty: state.difficulty,
		reps: state.reps,
		lapses: state.lapses,
		last_review: state.lastReview?.toISOString() ?? null,
	};
}

function generateClozeUid(): string {
	const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	let id = '';
	for (let i = 0; i < 12; i++) {
		id += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return id;
}

function yamlStringify(obj: Record<string, unknown>, indent = 0): string {
	const spaces = '  '.repeat(indent);
	const lines: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			lines.push(`${spaces}${key}: null`);
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${spaces}${key}: []`);
			} else {
				lines.push(`${spaces}${key}:`);
				for (const item of value) {
					if (typeof item === 'object' && item !== null) {
						lines.push(`${spaces}  -`);
						lines.push(yamlStringify(item as Record<string, unknown>, indent + 2));
					} else {
						lines.push(`${spaces}  - ${item}`);
					}
				}
			}
		} else if (typeof value === 'object') {
			lines.push(`${spaces}${key}:`);
			lines.push(yamlStringify(value as Record<string, unknown>, indent + 1));
		} else if (typeof value === 'string') {
			// Quote strings that might need it
			if (value.includes(':') || value.includes('#') || value.includes('\n')) {
				lines.push(`${spaces}${key}: "${value.replace(/"/g, '\\"')}"`);
			} else {
				lines.push(`${spaces}${key}: ${value}`);
			}
		} else {
			// Numbers, booleans - safe to convert to string
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			lines.push(`${spaces}${key}: ${String(value)}`);
		}
	}

	return lines.join('\n') + (indent === 0 ? '\n' : '');
}

/**
 * Write Anki revlog entries to IR/Revlog/ folder.
 * Groups entries by month and writes as JSONL.
 */
function writeRevlogEntries(
	vaultPath: string,
	revlog: AnkiRevlog[],
	cardIdMap: Map<number, string>,
): { imported: number; skipped: number } {
	const revlogDir = join(vaultPath, 'IR', 'Revlog');
	if (!existsSync(revlogDir)) {
		mkdirSync(revlogDir, { recursive: true });
	}

	// Group entries by month
	const entriesByMonth = new Map<string, string[]>();
	let imported = 0;
	let skipped = 0;

	for (const entry of revlog) {
		// Find the IR item ID for this card
		const itemId = cardIdMap.get(entry.cid);
		if (!itemId) {
			skipped++;
			continue;
		}

		// Convert Anki revlog to IR ReviewRecord
		const ts = new Date(entry.id);
		const record: ReviewRecord = {
			ts: ts.toISOString(),
			itemId,
			rating: entry.ease as Rating,
			elapsedMs: entry.time,
			stateBefore: ankiTypeToStatus(entry.type),
			stabilityBefore: Math.max(0, entry.lastIvl),
			difficultyBefore: ankiFactorToFsrsDifficulty(entry.factor),
		};

		// Get month key (YYYY-MM)
		const year = ts.getFullYear();
		const month = String(ts.getMonth() + 1).padStart(2, '0');
		const monthKey = `${year}-${month}`;

		const existing = entriesByMonth.get(monthKey) || [];
		existing.push(JSON.stringify(record));
		entriesByMonth.set(monthKey, existing);
		imported++;
	}

	// Write each month's file
	for (const [monthKey, lines] of entriesByMonth) {
		const filePath = join(revlogDir, `${monthKey}.md`);
		const content = lines.join('\n') + '\n';

		if (existsSync(filePath)) {
			appendFileSync(filePath, content, 'utf-8');
		} else {
			writeFileSync(filePath, content, 'utf-8');
		}
	}

	return { imported, skipped };
}

/**
 * Convert Anki revlog type to IR status.
 */
function ankiTypeToStatus(type: number): ReviewState['status'] {
	switch (type) {
		case 0:
			return 'learning'; // learn
		case 1:
			return 'review'; // review
		case 2:
			return 'relearning'; // relearn
		case 3:
			return 'review'; // filtered (treat as review)
		default:
			return 'new';
	}
}

/**
 * Convert Anki ease factor to FSRS difficulty.
 * Anki factor: 1300 (hard) to 2500+ (easy)
 * FSRS difficulty: ~1 (easy) to ~10 (hard)
 */
function ankiFactorToFsrsDifficulty(factor: number): number {
	const normalized = Math.max(1300, Math.min(3000, factor));
	const difficulty = (3000 - normalized) / 170;
	return Math.round(difficulty * 10) / 10;
}
