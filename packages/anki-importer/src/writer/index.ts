/**
 * Markdown Writer
 *
 * Writes imported Anki data to markdown files.
 * Handles directory structure and file generation.
 */

import type { AnkiImportResult } from '../importer/index.js'
import type { IRNoteId } from '../ir-types.js'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateIRNoteId } from '../ir-types.js'
import { writeCards } from './cards.js'
import { writeDecks } from './decks.js'
import { writeModels } from './models.js'
import { writeNotes } from './notes.js'

// =============================================================================
// Directory Structure
// =============================================================================

/**
 * Output directory structure under /Anki
 */
export interface OutputPaths {
	/** Root output directory (e.g., /path/to/vault/Anki) */
	readonly root: string
	/** Models directory: /Anki/_Models */
	readonly models: string
	/** Review log directory: /Anki/_RevLog */
	readonly revlog: string
	/** Media directory: /Anki/_Media */
	readonly media: string
}

/**
 * Create output paths from root directory
 */
export function createOutputPaths(root: string): OutputPaths {
	return {
		root,
		models: join(root, '_Models'),
		revlog: join(root, '_RevLog'),
		media: join(root, '_Media'),
	}
}

/**
 * Ensure all output directories exist
 */
export async function ensureDirectories(paths: OutputPaths, sidecarDir: string): Promise<void> {
	await Promise.all([
		mkdir(paths.models, { recursive: true }),
		mkdir(paths.revlog, { recursive: true }),
		mkdir(paths.media, { recursive: true }),
		mkdir(sidecarDir, { recursive: true }),
	])
}

// =============================================================================
// Write Result Types
// =============================================================================

/**
 * Result of writing files
 */
export interface WriteResult {
	readonly modelsWritten: number
	readonly notesWritten: number
	readonly cardsWritten: number
	readonly decksWritten: number
	readonly mediaWritten: number
	readonly errors: readonly WriteError[]
}

/**
 * Error during write operation
 */
export interface WriteError {
	readonly type: 'model' | 'note' | 'card' | 'deck' | 'media'
	readonly id: string
	readonly path: string
	readonly error: string
}

// =============================================================================
// Main Write Function
// =============================================================================

/**
 * Write options
 */
export interface WriteOptions {
	/** Root output directory for Anki notes (e.g., /path/to/vault/Anki) */
	readonly outputDir: string
	/** Sidecar directory for scheduling state (e.g., /path/to/vault/IR/Review Items) */
	readonly sidecarDir: string
	/** Vault-relative prefix for note paths (e.g., "Anki") */
	readonly vaultRelativePrefix: string
	/** Anki media directory (collection.media) */
	readonly mediaDir?: string
	/** Skip suspended cards */
	readonly skipSuspended?: boolean
	/** Collection creation timestamp for due date calculation */
	readonly collectionCreatedAt?: number
}

/**
 * Write all imported data to markdown files
 *
 * Notes are written to outputDir/{DeckPath}/{note_id}.md
 * Sidecars are written to sidecarDir/{ir_note_id}.md
 * Each sidecar contains note_path pointing to its note file
 */
export async function writeAnkiData(
	data: AnkiImportResult,
	options: WriteOptions,
): Promise<WriteResult> {
	const paths = createOutputPaths(options.outputDir)
	await ensureDirectories(paths, options.sidecarDir)

	const errors: WriteError[] = []

	// Write models
	const modelsWritten = await writeModels(data.models, paths.models, errors)

	// Build lookup maps for notes
	const modelMap = new Map(data.models.map((m) => [m.id as number, m]))
	const deckMap = new Map(data.decks.map((d) => [d.id as number, d]))

	// Generate ir_note_id for each note ONCE, shared by notes and cards writers
	const irNoteIdMap = new Map<number, IRNoteId>()
	for (const note of data.notes) {
		irNoteIdMap.set(note.id as number, generateIRNoteId())
	}

	// Map note IDs to vault-relative paths (populated by writeNotes, used by writeCards)
	const notePathMap = new Map<number, string>()

	// Write notes (organized by deck path)
	const notesWritten = await writeNotes(
		data.notes,
		data.cards,
		modelMap,
		deckMap,
		irNoteIdMap,
		notePathMap,
		paths.root,
		options.vaultRelativePrefix,
		errors,
	)

	// Write cards (scheduling sidecars) to IR/Review Items/
	const cardsWritten = await writeCards(
		data.notes,
		data.cards,
		modelMap,
		irNoteIdMap,
		notePathMap,
		options.sidecarDir,
		options.collectionCreatedAt ?? Math.floor(Date.now() / 1000),
		errors,
	)

	// Write deck tree
	const decksWritten = await writeDecks(data.decks, paths.root, errors)

	// Copy media files if provided
	let mediaWritten = 0
	if (options.mediaDir && existsSync(options.mediaDir)) {
		mediaWritten = await copyMedia(options.mediaDir, paths.media, errors)
	}

	return {
		modelsWritten,
		notesWritten,
		cardsWritten,
		decksWritten,
		mediaWritten,
		errors,
	}
}

// =============================================================================
// Media Copying
// =============================================================================

/**
 * Copy media files from Anki's collection.media to output
 */
async function copyMedia(
	sourceDir: string,
	destDir: string,
	errors: WriteError[],
): Promise<number> {
	let count = 0

	try {
		const files = await readdir(sourceDir)

		for (const file of files) {
			// Skip hidden files and directories
			if (file.startsWith('.')) continue

			try {
				const src = join(sourceDir, file)
				const dest = join(destDir, file)
				await copyFile(src, dest)
				count++
			} catch (err) {
				errors.push({
					type: 'media',
					id: file,
					path: join(destDir, file),
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}
	} catch (err) {
		errors.push({
			type: 'media',
			id: 'directory',
			path: sourceDir,
			error: err instanceof Error ? err.message : String(err),
		})
	}

	return count
}

export { writeCards } from './cards.js'
export { writeDecks } from './decks.js'
// Re-export individual writers
export { writeModels } from './models.js'
export { writeNotes } from './notes.js'
