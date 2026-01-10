/**
 * Anki to IR format converter.
 * Converts Anki notes/cards to Obsidian markdown with IR scheduling.
 */

import type { ReviewState } from '../types.js';
import type { AnkiCard, AnkiData } from './schema.js';
import { fieldsToMarkdown, parseAnkiFields } from './html.js';
import { filterDeckIds } from './reader.js';
import { ANKI_MODEL_TYPE, ANKI_QUEUE } from './schema.js';

export interface ImportOptions {
	/** Deck name filter pattern (e.g., "ANATOMI*" for prefix match) */
	deckFilter?: string;
	/** Skip suspended cards */
	skipSuspended?: boolean;
	/** Tag to add to imported notes */
	tag?: string;
}

export interface ImportedNote {
	id: string; // generated ir_note_id
	ankiNoteId: number; // original Anki note id
	deckPath: string; // Deck::Subdeck → Deck/Subdeck
	filename: string; // sanitized from first field
	content: string; // markdown with frontmatter
	type: 'topic' | 'item'; // topic for basic, item for cloze
	cards: ImportedCard[]; // one per Anki card
	mediaRefs: string[]; // all media files referenced
}

export interface ImportedCard {
	ankiCardId: number;
	clozeIndex?: number; // for cloze cards (1-based)
	clozeUid?: string; // unique ID for cloze item
	state: ReviewState;
}

export interface ImportResult {
	notes: ImportedNote[];
	allMediaRefs: Set<string>;
	/** Maps Anki card ID to IR item ID for revlog conversion */
	cardIdMap: Map<number, string>;
	stats: {
		total: number;
		cloze: number;
		basic: number;
		skipped: number;
	};
}

/**
 * Convert Anki data to IR format.
 */
export function convertAnkiToIR(data: AnkiData, options: ImportOptions = {}): ImportResult {
	const { deckFilter, skipSuspended = true, tag = 'anki-import' } = options;

	// Build deck filter set if specified
	let allowedDeckIds: Set<number> | null = null;
	if (deckFilter !== undefined && deckFilter !== '') {
		allowedDeckIds = filterDeckIds(data.decks, deckFilter);
	}

	// Group cards by note
	const cardsByNote = new Map<number, AnkiCard[]>();
	for (const card of data.cards) {
		// Skip suspended cards if requested
		if (skipSuspended && card.queue === ANKI_QUEUE.SUSPENDED) {
			continue;
		}

		// Skip cards not in allowed decks
		if (allowedDeckIds && !allowedDeckIds.has(card.did)) {
			continue;
		}

		const existing = cardsByNote.get(card.nid) || [];
		existing.push(card);
		cardsByNote.set(card.nid, existing);
	}

	const notes: ImportedNote[] = [];
	const allMediaRefs = new Set<string>();
	const cardIdMap = new Map<number, string>(); // Anki card ID → IR item ID
	let clozeCount = 0;
	let basicCount = 0;
	let skippedCount = 0;

	for (const note of data.notes) {
		const cards = cardsByNote.get(note.id);
		if (!cards || cards.length === 0) {
			skippedCount++;
			continue;
		}

		const model = data.models.get(note.mid);
		if (!model) {
			skippedCount++;
			continue;
		}

		// Get deck from first card (we know cards.length > 0 from earlier check)
		const firstCard = cards[0];
		if (firstCard === undefined) {
			skippedCount++;
			continue;
		}
		const deck = data.decks.get(firstCard.did);
		const deckPath = deck ? deckNameToPath(deck.name) : 'Uncategorized';

		// Parse note fields
		const fields = parseAnkiFields(note.flds);
		const fieldNames = model.flds.map((f) => f.name);

		// Convert to markdown
		const { markdown, mediaRefs } = fieldsToMarkdown(fields, fieldNames);
		for (const ref of mediaRefs) {
			allMediaRefs.add(ref);
		}

		// Determine note type
		const isCloze = model.type === ANKI_MODEL_TYPE.CLOZE;
		const noteType = isCloze ? 'item' : 'topic';

		if (isCloze) {
			clozeCount++;
		} else {
			basicCount++;
		}

		// Generate ID and use Anki note ID as filename for uniqueness
		const noteId = generateNoteId();
		const filename = String(note.id); // Use Anki note ID as filename

		// Convert cards to IR format and build card ID mapping
		const importedCards: ImportedCard[] = [];
		for (const card of cards) {
			const clozeIndex = isCloze ? card.ord + 1 : undefined;
			const clozeUid = isCloze ? generateNoteId() : undefined;

			// Build IR item ID: noteId for topics, noteId::clozeUid for cloze
			const irItemId = clozeUid !== undefined ? `${noteId}::${clozeUid}` : noteId;
			cardIdMap.set(card.id, irItemId);

			importedCards.push({
				ankiCardId: card.id,
				clozeIndex,
				clozeUid,
				state: convertSchedulingState(card),
			});
		}

		// Build note content with frontmatter
		const content = buildNoteContent({
			noteId,
			markdown,
			type: noteType,
			tag,
			priority: 50,
			clozeIndices: isCloze
				? importedCards.map((c) => c.clozeIndex).filter((i): i is number => i !== undefined)
				: [],
		});

		notes.push({
			id: noteId,
			ankiNoteId: note.id,
			deckPath,
			filename,
			content,
			type: noteType,
			cards: importedCards,
			mediaRefs,
		});
	}

	return {
		notes,
		allMediaRefs,
		cardIdMap,
		stats: {
			total: notes.length,
			cloze: clozeCount,
			basic: basicCount,
			skipped: skippedCount,
		},
	};
}

/**
 * Convert Anki deck name to folder path.
 * "Parent::Child::Grandchild" → "Parent/Child/Grandchild"
 */
function deckNameToPath(name: string): string {
	return name.split('::').map(sanitizeFilename).join('/');
}

/**
 * Convert Anki card scheduling to IR ReviewState.
 */
function convertSchedulingState(card: AnkiCard): ReviewState {
	// Map Anki queue to IR status
	let status: ReviewState['status'];
	switch (card.queue) {
		case ANKI_QUEUE.NEW:
			status = 'new';
			break;
		case ANKI_QUEUE.LEARNING:
			status = 'learning';
			break;
		case ANKI_QUEUE.REVIEW:
			status = 'review';
			break;
		case ANKI_QUEUE.RELEARNING:
			status = 'relearning';
			break;
		default:
			status = 'new';
	}

	// Convert Anki ease factor to FSRS difficulty
	// Anki: 2500 = 250% (easy), 1300 = 130% (hard)
	// FSRS difficulty: 0-10 scale (lower is easier)
	const difficulty = ankiFactorToFsrsDifficulty(card.factor);

	// Anki interval maps directly to FSRS stability (both in days)
	const stability = Math.max(0, card.ivl);

	// Calculate due date
	let due: Date | null = null;
	if (status === 'review' && card.due > 0) {
		// For review cards, due is a day number relative to collection creation
		// We'll set it relative to now for simplicity
		const daysFromNow = card.due - getDayNumber(new Date());
		if (daysFromNow <= 0) {
			due = new Date(); // Already due
		} else {
			due = new Date();
			due.setDate(due.getDate() + daysFromNow);
		}
	} else if (status === 'learning' && card.due > 0) {
		// For learning cards, due is a timestamp
		due = new Date(card.due * 1000);
	} else {
		due = new Date(); // Default to now
	}

	return {
		status,
		due,
		stability,
		difficulty,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: null, // Would need revlog to determine
	};
}

/**
 * Convert Anki ease factor to FSRS difficulty.
 * Anki factor: 1300 (hard) to 2500+ (easy)
 * FSRS difficulty: ~1 (easy) to ~10 (hard)
 */
function ankiFactorToFsrsDifficulty(factor: number): number {
	// Default factor is 2500 (250%)
	// Map 1300-3000 to 10-1 (inverted scale)
	const normalized = Math.max(1300, Math.min(3000, factor));
	const difficulty = (3000 - normalized) / 170; // Maps 2500→3, 1300→10, 3000→0
	return Math.round(difficulty * 10) / 10; // Round to 1 decimal
}

/**
 * Get Anki-style day number (days since epoch).
 */
function getDayNumber(date: Date): number {
	return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

/**
 * Generate a unique note ID (12-char alphanumeric).
 */
function generateNoteId(): string {
	const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	let id = '';
	for (let i = 0; i < 12; i++) {
		id += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return id;
}

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(name: string): string {
	return name
		.replace(/[<>:"/\\|?*]/g, '') // Remove illegal chars
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
		.slice(0, 100); // Limit length
}

interface NoteContentOptions {
	noteId: string;
	markdown: string;
	type: 'topic' | 'item';
	tag: string;
	priority: number;
	clozeIndices: number[];
}

/**
 * Build note content with YAML frontmatter.
 */
function buildNoteContent(options: NoteContentOptions): string {
	const { noteId, markdown, type, tag, priority, clozeIndices } = options;

	const frontmatter: Record<string, unknown> = {
		ir_note_id: noteId,
		tags: [tag],
		type,
		priority,
		created: new Date().toISOString().slice(0, 10),
	};

	if (clozeIndices.length > 0) {
		frontmatter.cloze = clozeIndices.map((i) => `c${i}`);
	}

	const yaml = Object.entries(frontmatter)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
			}
			return `${key}: ${String(value)}`;
		})
		.join('\n');

	return `---\n${yaml}\n---\n\n${markdown}\n`;
}
