/**
 * TypeScript types representing Anki's SQLite database schema.
 * Based on Anki 2.1.x collection structure.
 */

/**
 * Raw note from Anki's `notes` table.
 * A note contains the content, cards are scheduling instances.
 */
export interface AnkiNote {
	id: number;
	mid: number; // model/note type id
	flds: string; // fields joined by \x1f (unit separator)
	tags: string; // space-separated tags
	mod: number; // modification timestamp
}

/**
 * Raw card from Anki's `cards` table.
 * Each card represents one reviewable item from a note.
 */
export interface AnkiCard {
	id: number;
	nid: number; // note id
	did: number; // deck id
	ord: number; // card ordinal (for cloze: cloze index - 1)
	queue: number; // -1=suspended, 0=new, 1=learning, 2=review, 3=relearning
	type: number; // 0=new, 1=learning, 2=review, 3=relearning
	due: number; // due date (day number for review, timestamp for learning)
	ivl: number; // interval in days (negative = seconds for learning)
	factor: number; // ease factor (2500 = 250% = 2.5)
	reps: number; // total reviews
	lapses: number; // times failed
}

/**
 * Note type/model from Anki's `col.models` JSON.
 */
export interface AnkiModel {
	id: number;
	name: string;
	type: number; // 0=standard, 1=cloze
	flds: AnkiField[];
}

export interface AnkiField {
	name: string;
	ord: number;
}

/**
 * Deck from Anki's `col.decks` JSON.
 */
export interface AnkiDeck {
	id: number;
	name: string; // hierarchical with "::" separator (e.g., "Parent::Child")
}

/**
 * Review log entry from Anki's `revlog` table.
 */
export interface AnkiRevlog {
	id: number; // timestamp in milliseconds
	cid: number; // card id
	ease: number; // 1=again, 2=hard, 3=good, 4=easy
	ivl: number; // new interval
	lastIvl: number; // previous interval
	factor: number; // ease factor after review
	time: number; // review time in milliseconds
	type: number; // 0=learn, 1=review, 2=relearn, 3=filtered
}

/**
 * Data extracted from Anki's database.
 */
export interface AnkiData {
	notes: AnkiNote[];
	cards: AnkiCard[];
	models: Map<number, AnkiModel>;
	decks: Map<number, AnkiDeck>;
	revlog?: AnkiRevlog[];
}

/**
 * Anki queue/type status values.
 */
export const ANKI_QUEUE = {
	SUSPENDED: -1,
	NEW: 0,
	LEARNING: 1,
	REVIEW: 2,
	RELEARNING: 3,
} as const;

/**
 * Anki model types.
 * Note: Basic and Image Occlusion are detected by name pattern,
 * not by Anki's internal type value (which is only 0=standard or 1=cloze).
 */
export const ANKI_MODEL_TYPE = {
	STANDARD: 0,
	CLOZE: 1,
	// Extended types detected by name pattern (not native Anki values)
	BASIC: 2,
	IMAGE_OCCLUSION: 3,
} as const;
