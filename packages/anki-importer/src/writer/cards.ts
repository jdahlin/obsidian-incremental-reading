/**
 * Card Writer
 *
 * Writes card scheduling state (sidecars) to markdown files.
 */

import type { SchedulingStatus } from '../importer/cards.js'
import type { IRNoteId } from '../ir-types.js'
import type { Card, Model, Note } from '../types.js'
import type { WriteError } from './index.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { dueToDate, factorToDifficulty, queueToStatus } from '../importer/cards.js'
import { extractClozeIndices } from '../importer/notes.js'
import { generateClozeUid } from '../ir-types.js'
import { NotetypeKind } from '../types.js'

// =============================================================================
// Scheduling State Types
// =============================================================================

interface FSRSState {
	readonly status: SchedulingStatus
	readonly due: string
	readonly stability: number
	readonly difficulty: number
	readonly reps: number
	readonly lapses: number
	readonly last_review: string | null
}

interface ClozeState extends FSRSState {
	readonly cloze_uid: string
}

interface BasicSidecar {
	readonly ir_note_id: string
	readonly note_path: string
	readonly anki_note_id: string
	readonly type: 'basic'
	readonly priority: number
	readonly basic: FSRSState
}

interface ClozeSidecar {
	readonly ir_note_id: string
	readonly note_path: string
	readonly anki_note_id: string
	readonly type: 'cloze' | 'image_occlusion'
	readonly priority: number
	readonly clozes: Record<string, ClozeState>
}

type Sidecar = BasicSidecar | ClozeSidecar

// =============================================================================
// Note Type Detection
// =============================================================================

type NoteType = 'basic' | 'cloze' | 'image_occlusion' | 'standard'

function getNoteType(model: Model): NoteType {
	const fieldNames = model.fields.map((f) => f.name.toLowerCase())
	if (fieldNames.includes('occlusion') && fieldNames.includes('image')) {
		return 'image_occlusion'
	}
	if (model.kind === NotetypeKind.Cloze) {
		return 'cloze'
	}
	if (fieldNames.includes('front') && fieldNames.includes('back')) {
		return 'basic'
	}
	return 'standard'
}

// =============================================================================
// Sidecar Generation
// =============================================================================

/**
 * Create FSRS state from Anki card
 */
function createFSRSState(card: Card, collectionCreatedAt: number): FSRSState | null {
	const status = queueToStatus(card.queue, card.type)
	if (status === null) {
		return null // Suspended
	}

	const due = dueToDate(card.due, card.queue, collectionCreatedAt)

	return {
		status,
		due: due.toISOString(),
		stability: card.interval as number,
		difficulty: Math.round(factorToDifficulty(card.factor as number) * 100) / 100,
		reps: card.reps,
		lapses: card.lapses,
		last_review: null, // Would need revlog to populate this
	}
}

/**
 * Generate sidecar for a note
 */
function generateSidecar(
	note: Note,
	notePath: string,
	cards: Card[],
	model: Model,
	irNoteId: string,
	collectionCreatedAt: number,
): Sidecar | null {
	const noteType = getNoteType(model)

	// Filter out suspended cards
	const activeCards = cards.filter((c) => {
		const status = queueToStatus(c.queue, c.type)
		return status !== null
	})

	if (activeCards.length === 0) {
		return null // All cards suspended
	}

	if (noteType === 'cloze' || noteType === 'image_occlusion') {
		// Cloze/IO: one scheduling entry per cloze index
		const clozeIndices = extractClozeIndices(note.fieldValues)
		const clozes: Record<string, ClozeState> = {}

		for (const idx of clozeIndices) {
			// Find card for this cloze (ord = cloze_index - 1)
			const card = activeCards.find((c) => (c.ord as number) === idx - 1)
			if (card) {
				const state = createFSRSState(card, collectionCreatedAt)
				if (state) {
					clozes[`c${idx}`] = {
						...state,
						cloze_uid: generateClozeUid(),
					}
				}
			} else {
				// No card yet for this cloze, create new state
				clozes[`c${idx}`] = {
					cloze_uid: generateClozeUid(),
					status: 'new',
					due: new Date().toISOString(),
					stability: 0,
					difficulty: 5,
					reps: 0,
					lapses: 0,
					last_review: null,
				}
			}
		}

		if (Object.keys(clozes).length === 0) {
			return null
		}

		return {
			ir_note_id: irNoteId,
			note_path: notePath,
			anki_note_id: String(note.id),
			type: noteType,
			priority: 50,
			clozes,
		}
	} else {
		// Basic/Standard: single scheduling entry
		const card = activeCards[0]
		if (!card) return null

		const state = createFSRSState(card, collectionCreatedAt)
		if (!state) return null

		return {
			ir_note_id: irNoteId,
			note_path: notePath,
			anki_note_id: String(note.id),
			type: 'basic',
			priority: 50,
			basic: state,
		}
	}
}

/**
 * Convert sidecar to markdown content
 */
function sidecarToMarkdown(sidecar: Sidecar): string {
	const yaml = yamlStringify(sidecar, {
		indent: 2,
		lineWidth: 0,
	})

	return `---\n${yaml}---\n`
}

// =============================================================================
// Write Function
// =============================================================================

/**
 * Write all card scheduling sidecars to IR/Review Items/
 *
 * @param notePathMap - Map of note ID to vault-relative note path
 * @param outputDir - Absolute path to IR/Review Items/ directory
 */
export async function writeCards(
	notes: readonly Note[],
	cards: readonly Card[],
	modelMap: Map<number, Model>,
	irNoteIdMap: Map<number, IRNoteId>,
	notePathMap: Map<number, string>,
	outputDir: string,
	collectionCreatedAt: number,
	errors: WriteError[],
): Promise<number> {
	let count = 0

	// Group cards by note
	const cardsByNote = new Map<number, Card[]>()
	for (const card of cards) {
		const nid = card.noteId as number
		const existing = cardsByNote.get(nid) ?? []
		existing.push(card)
		cardsByNote.set(nid, existing)
	}

	for (const note of notes) {
		const model = modelMap.get(note.modelId as number)
		if (!model) continue

		const noteCards = cardsByNote.get(note.id as number) ?? []
		if (noteCards.length === 0) continue

		// Get ir_note_id from shared map (coordinated with notes writer)
		const irNoteId = irNoteIdMap.get(note.id as number)
		if (!irNoteId) continue

		// Get vault-relative note path (coordinated with notes writer)
		const notePath = notePathMap.get(note.id as number)
		if (!notePath) continue

		const sidecar = generateSidecar(
			note,
			notePath,
			noteCards,
			model,
			irNoteId,
			collectionCreatedAt,
		)

		if (!sidecar) continue

		const filename = `${irNoteId}.md`
		const filePath = join(outputDir, filename)

		try {
			const content = sidecarToMarkdown(sidecar)
			await writeFile(filePath, content, 'utf-8')
			count++
		} catch (err) {
			errors.push({
				type: 'card',
				id: String(note.id),
				path: filePath,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return count
}
