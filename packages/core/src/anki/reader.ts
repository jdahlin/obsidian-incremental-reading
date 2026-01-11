/* eslint-disable no-control-regex */
/**
 * SQLite reader for Anki's collection database.
 * Supports modern Anki schema (separate notetypes/fields/decks tables).
 */

import type {
	AnkiCard,
	AnkiData,
	AnkiDeck,
	AnkiField,
	AnkiModel,
	AnkiNote,
	AnkiRevlog,
} from './schema.js'
import { existsSync, statSync } from 'node:fs'
import Database from 'better-sqlite3'

interface DeckRow {
	id: number
	name: string
}

interface NoteTypeRow {
	id: number
	name: string
}

interface FieldRow {
	ntid: number
	ord: number
	name: string
}

/**
 * Check if Anki appears to be running (non-empty WAL file exists).
 * Reading the database while Anki is open can cause corruption.
 * Note: Empty WAL files (0 bytes) are safe - Anki sometimes leaves
 * these behind after closing.
 */
export function isAnkiRunning(dbPath: string): boolean {
	const walPath = `${dbPath}-wal`
	if (!existsSync(walPath)) return false

	// Check if WAL file has content (non-empty means uncommitted transactions)
	const stats = statSync(walPath)
	return stats.size > 0
}

/**
 * Read and parse Anki's collection database.
 * @throws Error if Anki appears to be running (WAL files exist)
 */
export function readAnkiDatabase(dbPath: string, includeRevlog = false): AnkiData {
	// Check for WAL files - indicates Anki is running
	if (isAnkiRunning(dbPath)) {
		throw new Error(
			'Anki appears to be running (WAL files detected). ' +
				'Please close Anki completely before importing to avoid database corruption.',
		)
	}

	const db = new Database(dbPath, { readonly: true })

	try {
		const models = readModels(db)
		const decks = readDecks(db)

		// Read notes
		const notes = db.prepare('SELECT id, mid, flds, tags, mod FROM notes').all() as AnkiNote[]

		// Read cards
		const cards = db
			.prepare(
				'SELECT id, nid, did, ord, queue, type, due, ivl, factor, reps, lapses FROM cards',
			)
			.all() as AnkiCard[]

		// Optionally read review log
		let revlog: AnkiRevlog[] | undefined
		if (includeRevlog) {
			revlog = db
				.prepare('SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog')
				.all() as AnkiRevlog[]
		}

		return { notes, cards, models, decks, revlog }
	} finally {
		db.close()
	}
}

/**
 * Read models from notetypes + fields tables.
 */
function readModels(db: Database.Database): Map<number, AnkiModel> {
	const result = new Map<number, AnkiModel>()

	// Read note types
	const noteTypes = db.prepare('SELECT id, name FROM notetypes').all() as NoteTypeRow[]

	// Read fields for all note types
	const fields = db
		.prepare('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')
		.all() as FieldRow[]

	// Group fields by note type
	const fieldsByNoteType = new Map<number, AnkiField[]>()
	for (const field of fields) {
		const existing = fieldsByNoteType.get(field.ntid) || []
		existing.push({ name: field.name, ord: field.ord })
		fieldsByNoteType.set(field.ntid, existing)
	}

	for (const nt of noteTypes) {
		// Detect model type by name pattern
		const nameLower = nt.name.toLowerCase()
		let modelType: number

		if (nameLower.includes('image occlusion') || nameLower.includes('imageocclusion')) {
			modelType = 3 // IMAGE_OCCLUSION
		} else if (nameLower.includes('cloze')) {
			modelType = 1 // CLOZE
		} else if (
			nameLower.includes('basic') ||
			nameLower === 'default' ||
			nameLower.startsWith('basic ')
		) {
			modelType = 2 // BASIC
		} else {
			modelType = 0 // STANDARD (topic)
		}

		result.set(nt.id, {
			id: nt.id,
			name: nt.name,
			type: modelType,
			flds: fieldsByNoteType.get(nt.id) || [],
		})
	}

	return result
}

/**
 * Read decks from decks table.
 */
function readDecks(db: Database.Database): Map<number, AnkiDeck> {
	const result = new Map<number, AnkiDeck>()

	const decks = db.prepare('SELECT id, name FROM decks').all() as DeckRow[]

	for (const deck of decks) {
		// Anki uses \x1f (unit separator) as hierarchy separator, convert to ::
		const name = deck.name.replace(/\x1F/g, '::')
		result.set(deck.id, {
			id: deck.id,
			name,
		})
	}

	return result
}

/**
 * Get all deck IDs that match a filter pattern.
 * Supports prefix matching with wildcard (e.g., "ANATOMI*").
 * Matching is case-sensitive.
 */
export function filterDeckIds(decks: Map<number, AnkiDeck>, pattern: string): Set<number> {
	const result = new Set<number>()

	// Check if pattern ends with * (prefix match)
	const isPrefix = pattern.endsWith('*')
	const prefix = isPrefix ? pattern.slice(0, -1) : pattern

	for (const [id, deck] of decks) {
		const name = deck.name

		if (isPrefix) {
			// Match deck name starting with prefix (case-sensitive)
			if (name.startsWith(prefix)) {
				result.add(id)
			}
		} else {
			// Exact match or subdeck match (case-sensitive)
			if (name === pattern || name.startsWith(`${pattern}::`)) {
				result.add(id)
			}
		}
	}

	return result
}
