/**
 * Note Importer
 *
 * Reads notes from Anki database and parses field values.
 */

import type Database from 'better-sqlite3'
import type { Model, Note, NoteRow } from '../types.js'
import { readNotes } from '../database.js'
import { modelId, noteId, parseFieldValues, parseTags } from '../types.js'

// =============================================================================
// Hydration Functions
// =============================================================================

/**
 * Convert raw note row to hydrated Note
 */
export function hydrateNote(row: NoteRow): Note {
	return {
		id: noteId(row.id),
		guid: row.guid,
		modelId: modelId(row.mid),
		tags: parseTags(row.tags),
		fieldValues: parseFieldValues(row.flds),
		modifiedAt: new Date(row.mod * 1000),
	}
}

// =============================================================================
// Import Function
// =============================================================================

/**
 * Import all notes from database
 *
 * @param db - Database connection
 * @param models - Models to validate against (optional)
 */
export function importNotes(db: Database.Database, _models?: readonly Model[]): Note[] {
	const rows = readNotes(db)
	const notes = rows.map(hydrateNote)

	// If models provided, we could validate field counts match
	// For now, just return all notes
	return notes
}

// =============================================================================
// Note Utilities
// =============================================================================

/**
 * Build a note lookup map by ID
 */
export function buildNoteMap(notes: readonly Note[]): Map<number, Note> {
	const map = new Map<number, Note>()
	for (const note of notes) {
		map.set(note.id as number, note)
	}
	return map
}

/**
 * Group notes by model ID
 */
export function groupNotesByModel(notes: readonly Note[]): Map<number, Note[]> {
	const map = new Map<number, Note[]>()
	for (const note of notes) {
		const mid = note.modelId as number
		const existing = map.get(mid) ?? []
		existing.push(note)
		map.set(mid, existing)
	}
	return map
}

/**
 * Extract cloze indices from field values
 * Finds all {{c1::...}}, {{c2::...}} etc patterns
 */
export function extractClozeIndices(fieldValues: readonly string[]): number[] {
	const indices = new Set<number>()
	const pattern = /\{\{c(\d+)::/g

	for (const value of fieldValues) {
		let match
		while ((match = pattern.exec(value)) !== null) {
			const index = Number.parseInt(match[1]!, 10)
			if (!Number.isNaN(index) && index > 0) {
				indices.add(index)
			}
		}
	}

	return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Get the first non-empty field value (for display/sorting)
 */
export function getFirstFieldValue(note: Note): string {
	for (const value of note.fieldValues) {
		const trimmed = value.trim()
		if (trimmed.length > 0) {
			return trimmed
		}
	}
	return ''
}
