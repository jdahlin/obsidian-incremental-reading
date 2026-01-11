/**
 * Test script to import Anki models to test-vault
 * Uses the TypeScript database module directly
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import {
	exportAllModels,
	getDatabaseStats,
	openAnkiDatabase,
} from '../src/index.js'

const ANKI_DB_PATH = '/Users/johandahlin/Library/Application Support/Anki2/User 1/collection.anki2'
const OUTPUT_DIR = join(import.meta.dirname, '../../test-vault/IR/Anki-Import/Models')

async function main() {
	console.log('Opening Anki database...\n')

	const db = openAnkiDatabase(ANKI_DB_PATH)

	try {
		// Get stats
		const stats = getDatabaseStats(db)
		console.log('Database Statistics:')
		console.log(`  Notetypes: ${stats.notetypeCount}`)
		console.log(`  Notes: ${stats.noteCount}`)
		console.log(`  Cards: ${stats.cardCount}`)
		console.log(`  Decks: ${stats.deckCount}`)

		// Export models
		console.log('\nExporting models...')
		const result = exportAllModels(db)

		console.log(`\nModel Summary:`)
		console.log(`  Total: ${result.totalModels}`)
		console.log(`  Standard: ${result.normalModels}`)
		console.log(`  Cloze: ${result.clozeModels}`)
		console.log(`  Image Occlusion: ${result.imageOcclusionModels}`)

		// Create output directory
		await mkdir(OUTPUT_DIR, { recursive: true })

		// Write model files
		console.log(`\nWriting to ${OUTPUT_DIR}...\n`)
		for (const exported of result.models) {
			const path = join(OUTPUT_DIR, exported.filename)
			await writeFile(path, exported.content, 'utf-8')
			console.log(`  ${exported.filename}`)
		}

		console.log(`\n---`)
		console.log(`Exported ${result.totalModels} models.`)
		console.log(`Output: ${OUTPUT_DIR}`)
	} finally {
		db.close()
	}
}

main().catch(console.error)
