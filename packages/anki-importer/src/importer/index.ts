/**
 * Anki Database Importer
 *
 * Reads Anki SQLite database and returns typed objects.
 * Does NOT write to filesystem - that's the writer's job.
 */

import type Database from 'better-sqlite3'
import type { Card, Deck, Model, Note } from '../types.js'
import { openAnkiDatabase } from '../database.js'
import { importCards } from './cards.js'
import { importDecks } from './decks.js'
import { importModels } from './models.js'
import { importNotes } from './notes.js'

// =============================================================================
// Import Result Types
// =============================================================================

/**
 * Complete import result from Anki database
 */
export interface AnkiImportResult {
	readonly models: readonly Model[]
	readonly decks: readonly Deck[]
	readonly notes: readonly Note[]
	readonly cards: readonly Card[]
	readonly stats: ImportStats
}

/**
 * Import statistics
 */
export interface ImportStats {
	readonly modelCount: number
	readonly deckCount: number
	readonly noteCount: number
	readonly cardCount: number
	readonly importedAt: Date
}

// =============================================================================
// Main Import Function
// =============================================================================

/**
 * Import all data from Anki database
 *
 * @param dbPath - Path to collection.anki2 file
 * @returns Complete import result with all entities
 */
export function importAnkiDatabase(dbPath: string): AnkiImportResult {
	const db = openAnkiDatabase(dbPath)

	try {
		const models = importModels(db)
		const decks = importDecks(db)
		const notes = importNotes(db, models)
		const cards = importCards(db)

		return {
			models,
			decks,
			notes,
			cards,
			stats: {
				modelCount: models.length,
				deckCount: decks.length,
				noteCount: notes.length,
				cardCount: cards.length,
				importedAt: new Date(),
			},
		}
	} finally {
		db.close()
	}
}

/**
 * Import with open database connection (for incremental/partial imports)
 */
export function importFromDatabase(db: Database.Database): AnkiImportResult {
	const models = importModels(db)
	const decks = importDecks(db)
	const notes = importNotes(db, models)
	const cards = importCards(db)

	return {
		models,
		decks,
		notes,
		cards,
		stats: {
			modelCount: models.length,
			deckCount: decks.length,
			noteCount: notes.length,
			cardCount: cards.length,
			importedAt: new Date(),
		},
	}
}

export { importCards } from './cards.js'
export { importDecks } from './decks.js'
// Re-export individual importers for granular use
export { importModels } from './models.js'
export { importNotes } from './notes.js'
