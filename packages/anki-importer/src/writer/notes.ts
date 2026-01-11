/**
 * Note Writer
 *
 * Writes notes to markdown files organized by deck path.
 */

import type {IRNoteId} from '../ir-types.js';
import type { Card, Deck, Model, Note } from '../types.js'
import type { WriteError } from './index.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { getDeckPath } from '../importer/decks.js'
import { extractClozeIndices } from '../importer/notes.js'
import { NotetypeKind } from '../types.js'

// =============================================================================
// Note Type Detection
// =============================================================================

type NoteType = 'basic' | 'cloze' | 'image_occlusion' | 'standard'

/**
 * Determine note type from model
 */
function getNoteType(model: Model): NoteType {
	// Check for Image Occlusion by field names
	const fieldNames = model.fields.map(f => f.name.toLowerCase())
	if (fieldNames.includes('occlusion') && fieldNames.includes('image')) {
		return 'image_occlusion'
	}

	// Check model kind
	if (model.kind === NotetypeKind.Cloze) {
		return 'cloze'
	}

	// Check for Basic pattern (Front/Back fields)
	if (fieldNames.includes('front') && fieldNames.includes('back')) {
		return 'basic'
	}

	return 'standard'
}

// =============================================================================
// Markdown Generation
// =============================================================================

/**
 * Note frontmatter for YAML
 */
interface NoteFrontmatter {
	readonly ir_note_id: string
	readonly anki_note_id: string
	readonly anki_model_id: string
	readonly tags: readonly string[]
	readonly created: string
	readonly type: NoteType
	readonly priority: number
	readonly cloze?: readonly string[]
}

/**
 * Convert HTML to basic markdown
 * Simple conversion for common patterns
 */
function htmlToMarkdown(html: string): string {
	return html
		// Convert line breaks
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<div[^>]*>/gi, '')
		// Convert bold
		.replace(/<b>|<strong>/gi, '**')
		.replace(/<\/b>|<\/strong>/gi, '**')
		// Convert italic
		.replace(/<i>|<em>/gi, '*')
		.replace(/<\/i>|<\/em>/gi, '*')
		// Convert images
		.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '![]($1)')
		// Convert audio (Anki format)
		.replace(/\[sound:([^\]]+)\]/g, '![]($1)')
		// Remove other HTML tags but keep content
		.replace(/<[^>]+>/g, '')
		// Clean up whitespace
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

/**
 * Convert Note to markdown content
 */
export function noteToMarkdown(
	note: Note,
	model: Model,
	irNoteId: string,
): string {
	const noteType = getNoteType(model)
	const clozeIndices = (noteType === 'cloze' || noteType === 'image_occlusion')
		? extractClozeIndices(note.fieldValues)
		: []

	const frontmatter: NoteFrontmatter = {
		ir_note_id: irNoteId,
		anki_note_id: String(note.id),
		anki_model_id: String(note.modelId),
		tags: note.tags,
		created: note.modifiedAt.toISOString().split('T')[0]!,
		type: noteType,
		priority: 50,
		...(clozeIndices.length > 0 && {
			cloze: clozeIndices.map(i => `c${i}`),
		}),
	}

	const yaml = yamlStringify(frontmatter, {
		indent: 2,
		lineWidth: 0,
	})

	// Build field sections
	const fieldSections = model.fields.map((field, i) => {
		const value = note.fieldValues[i] ?? ''
		const content = htmlToMarkdown(value)
		return `## ${field.name}\n\n${content}`
	}).join('\n\n')

	return `---\n${yaml}---\n\n${fieldSections}\n`
}

/**
 * Get filename for a note
 */
export function getNoteFilename(note: Note): string {
	return `${note.id}.md`
}

// =============================================================================
// Write Function
// =============================================================================

/**
 * Write all notes to markdown files
 */
export async function writeNotes(
	notes: readonly Note[],
	cards: readonly Card[],
	modelMap: Map<number, Model>,
	deckMap: Map<number, Deck>,
	irNoteIdMap: Map<number, IRNoteId>,
	outputRoot: string,
	errors: WriteError[],
): Promise<number> {
	let count = 0

	// Group cards by note to determine deck for each note
	const cardsByNote = new Map<number, Card[]>()
	for (const card of cards) {
		const nid = card.noteId as number
		const existing = cardsByNote.get(nid) ?? []
		existing.push(card)
		cardsByNote.set(nid, existing)
	}

	// Track created directories to avoid redundant mkdir calls
	const createdDirs = new Set<string>()

	for (const note of notes) {
		const model = modelMap.get(note.modelId as number)
		if (!model) {
			errors.push({
				type: 'note',
				id: String(note.id),
				path: '',
				error: `Model ${note.modelId} not found`,
			})
			continue
		}

		// Get ir_note_id from shared map
		const irNoteId = irNoteIdMap.get(note.id as number)
		if (!irNoteId) {
			errors.push({
				type: 'note',
				id: String(note.id),
				path: '',
				error: `No ir_note_id generated for note ${note.id}`,
			})
			continue
		}

		// Get deck from first card
		const noteCards = cardsByNote.get(note.id as number) ?? []
		const firstCard = noteCards[0]
		const deck = firstCard ? deckMap.get(firstCard.deckId as number) : undefined

		// Determine output path
		const deckPath = deck ? getDeckPath(deck) : 'Default'
		const dirPath = join(outputRoot, deckPath)
		const filename = getNoteFilename(note)
		const filePath = join(dirPath, filename)

		// Ensure directory exists
		if (!createdDirs.has(dirPath)) {
			try {
				await mkdir(dirPath, { recursive: true })
				createdDirs.add(dirPath)
			} catch {
				// Directory might already exist, continue
			}
		}

		try {
			const content = noteToMarkdown(note, model, irNoteId)
			await writeFile(filePath, content, 'utf-8')
			count++
		} catch (err) {
			errors.push({
				type: 'note',
				id: String(note.id),
				path: filePath,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return count
}
