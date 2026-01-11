/**
 * Anki Database Reader
 *
 * Reads from Anki SQLite database (schema v18) with proper handling
 * of collations and data types.
 */

import type {
	CardRow,
	DeckRow,
	FieldRow,
	NoteRow,
	NotetypeRow,
	TemplateRow,
} from './types.js'
import Database from 'better-sqlite3'

// =============================================================================
// Database Connection
// =============================================================================

/**
 * Open an Anki database with required collations
 *
 * @param dbPath - Path to collection.anki2 file
 * @returns Database connection configured for Anki
 */
export function openAnkiDatabase(dbPath: string): Database.Database {
	// Open in read-only mode for safety
	// Note: Anki's schema uses 'unicase' collation on some columns (name columns).
	// We avoid ORDER BY on those columns to prevent collation errors.
	// Sorting is done in JavaScript instead when needed.
	return new Database(dbPath, { readonly: true })
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Read all notetypes (models) from database
 */
export function readNotetypes(db: Database.Database): NotetypeRow[] {
	// Note: We don't ORDER BY name here because it has unicase collation
	// which requires a custom collation function not available in better-sqlite3.
	// Sort in JavaScript if needed.
	const stmt = db.prepare<[], NotetypeRow>(`
		SELECT id, name, mtime_secs, usn, config
		FROM notetypes
	`)
	return stmt.all()
}

/**
 * Read all fields from database
 * @returns Fields sorted by notetype ID and ordinal
 */
export function readFields(db: Database.Database): FieldRow[] {
	const stmt = db.prepare<[], FieldRow>(`
		SELECT ntid, ord, name, config
		FROM fields
		ORDER BY ntid, ord
	`)
	return stmt.all()
}

/**
 * Read all templates from database
 * @returns Templates sorted by notetype ID and ordinal
 */
export function readTemplates(db: Database.Database): TemplateRow[] {
	const stmt = db.prepare<[], TemplateRow>(`
		SELECT ntid, ord, name, mtime_secs, usn, config
		FROM templates
		ORDER BY ntid, ord
	`)
	return stmt.all()
}

/**
 * Read fields for a specific notetype
 */
export function readFieldsForNotetype(db: Database.Database, notetypeId: number): FieldRow[] {
	const stmt = db.prepare<[number], FieldRow>(`
		SELECT ntid, ord, name, config
		FROM fields
		WHERE ntid = ?
		ORDER BY ord
	`)
	return stmt.all(notetypeId)
}

/**
 * Read templates for a specific notetype
 */
export function readTemplatesForNotetype(db: Database.Database, notetypeId: number): TemplateRow[] {
	const stmt = db.prepare<[number], TemplateRow>(`
		SELECT ntid, ord, name, mtime_secs, usn, config
		FROM templates
		WHERE ntid = ?
		ORDER BY ord
	`)
	return stmt.all(notetypeId)
}

/**
 * Read all notes from database
 */
export function readNotes(db: Database.Database): NoteRow[] {
	const stmt = db.prepare<[], NoteRow>(`
		SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data
		FROM notes
		ORDER BY id
	`)
	return stmt.all()
}

/**
 * Read notes for a specific notetype
 */
export function readNotesForNotetype(db: Database.Database, notetypeId: number): NoteRow[] {
	const stmt = db.prepare<[number], NoteRow>(`
		SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data
		FROM notes
		WHERE mid = ?
		ORDER BY id
	`)
	return stmt.all(notetypeId)
}

/**
 * Read all cards from database
 */
export function readCards(db: Database.Database): CardRow[] {
	const stmt = db.prepare<[], CardRow>(`
		SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data
		FROM cards
		ORDER BY nid, ord
	`)
	return stmt.all()
}

/**
 * Read cards for a specific note
 */
export function readCardsForNote(db: Database.Database, noteId: number): CardRow[] {
	const stmt = db.prepare<[number], CardRow>(`
		SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data
		FROM cards
		WHERE nid = ?
		ORDER BY ord
	`)
	return stmt.all(noteId)
}

/**
 * Read all decks from database
 */
export function readDecks(db: Database.Database): DeckRow[] {
	// Note: We don't ORDER BY name here because it has unicase collation.
	// Sort in JavaScript if needed.
	const stmt = db.prepare<[], DeckRow>(`
		SELECT id, name, mtime_secs, usn, common, kind
		FROM decks
	`)
	return stmt.all()
}

/**
 * Read a specific deck by ID
 */
export function readDeck(db: Database.Database, deckId: number): DeckRow | undefined {
	const stmt = db.prepare<[number], DeckRow>(`
		SELECT id, name, mtime_secs, usn, common, kind
		FROM decks
		WHERE id = ?
	`)
	return stmt.get(deckId)
}

// =============================================================================
// Aggregated Queries
// =============================================================================

/**
 * Count notes per notetype
 */
export function countNotesPerNotetype(
	db: Database.Database,
): Map<number, number> {
	const stmt = db.prepare<[], { mid: number; count: number }>(`
		SELECT mid, COUNT(*) as count
		FROM notes
		GROUP BY mid
	`)
	const rows = stmt.all()
	return new Map(rows.map((row) => [row.mid, row.count]))
}

/**
 * Count cards per deck
 */
export function countCardsPerDeck(db: Database.Database): Map<number, number> {
	const stmt = db.prepare<[], { did: number; count: number }>(`
		SELECT did, COUNT(*) as count
		FROM cards
		GROUP BY did
	`)
	const rows = stmt.all()
	return new Map(rows.map((row) => [row.did, row.count]))
}

/**
 * Get database creation time from col table
 */
export function getCollectionCreationTime(db: Database.Database): number {
	const stmt = db.prepare<[], { crt: number }>(`
		SELECT crt FROM col
	`)
	const row = stmt.get()
	return row?.crt ?? 0
}

/**
 * Get collection modification time
 */
export function getCollectionModTime(db: Database.Database): number {
	const stmt = db.prepare<[], { mod: number }>(`
		SELECT mod FROM col
	`)
	const row = stmt.get()
	return row?.mod ?? 0
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Database statistics summary
 */
export interface DatabaseStats {
	readonly notetypeCount: number
	readonly noteCount: number
	readonly cardCount: number
	readonly deckCount: number
	readonly collectionCreated: Date
	readonly collectionModified: Date
}

/**
 * Get database statistics
 */
export function getDatabaseStats(db: Database.Database): DatabaseStats {
	// Note: We use COUNT(id) instead of COUNT(*) because COUNT(*) triggers
	// evaluation of all columns, including those with unicase collation.
	const notetypeCount = db.prepare<[], { count: number }>('SELECT COUNT(id) as count FROM notetypes').get()?.count ?? 0
	const noteCount = db.prepare<[], { count: number }>('SELECT COUNT(id) as count FROM notes').get()?.count ?? 0
	const cardCount = db.prepare<[], { count: number }>('SELECT COUNT(id) as count FROM cards').get()?.count ?? 0
	const deckCount = db.prepare<[], { count: number }>('SELECT COUNT(id) as count FROM decks').get()?.count ?? 0
	const crt = getCollectionCreationTime(db)
	const mod = getCollectionModTime(db)

	return {
		notetypeCount,
		noteCount,
		cardCount,
		deckCount,
		collectionCreated: new Date(crt * 1000),
		collectionModified: new Date(mod * 1000),
	}
}
