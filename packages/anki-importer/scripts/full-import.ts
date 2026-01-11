/**
 * Full Import Script
 *
 * Imports all Anki data to test-vault/Anki/
 */

import { join } from 'node:path'
import { importAnkiDatabase } from '../src/importer/index.js'
import { writeAnkiData } from '../src/writer/index.js'
import { getCollectionCreationTime, openAnkiDatabase } from '../src/database.js'

const ANKI_DB_PATH = '/Users/johandahlin/Library/Application Support/Anki2/User 1/collection.anki2'
const ANKI_MEDIA_PATH = '/Users/johandahlin/Library/Application Support/Anki2/User 1/collection.media'
const OUTPUT_DIR = join(import.meta.dirname, '../../test-vault/Anki')

async function main() {
	console.log('='.repeat(60))
	console.log('Anki Full Import')
	console.log('='.repeat(60))
	console.log()

	// Step 1: Import from database
	console.log('Step 1: Reading Anki database...')
	console.log(`  Source: ${ANKI_DB_PATH}`)
	console.log()

	const startImport = Date.now()
	const data = importAnkiDatabase(ANKI_DB_PATH)
	const importTime = Date.now() - startImport

	console.log('Import Statistics:')
	console.log(`  Models:  ${data.stats.modelCount}`)
	console.log(`  Decks:   ${data.stats.deckCount}`)
	console.log(`  Notes:   ${data.stats.noteCount}`)
	console.log(`  Cards:   ${data.stats.cardCount}`)
	console.log(`  Time:    ${importTime}ms`)
	console.log()

	// Get collection creation time for scheduling conversion
	const db = openAnkiDatabase(ANKI_DB_PATH)
	const collectionCreatedAt = getCollectionCreationTime(db)
	db.close()

	// Step 2: Write to markdown
	console.log('Step 2: Writing markdown files...')
	console.log(`  Output: ${OUTPUT_DIR}`)
	console.log()

	const startWrite = Date.now()
	const result = await writeAnkiData(data, {
		outputDir: OUTPUT_DIR,
		mediaDir: ANKI_MEDIA_PATH,
		collectionCreatedAt,
	})
	const writeTime = Date.now() - startWrite

	console.log('Write Statistics:')
	console.log(`  Models:  ${result.modelsWritten}`)
	console.log(`  Notes:   ${result.notesWritten}`)
	console.log(`  Cards:   ${result.cardsWritten}`)
	console.log(`  Decks:   ${result.decksWritten}`)
	console.log(`  Media:   ${result.mediaWritten}`)
	console.log(`  Time:    ${writeTime}ms`)
	console.log()

	if (result.errors.length > 0) {
		console.log('Errors:')
		for (const error of result.errors.slice(0, 10)) {
			console.log(`  [${error.type}] ${error.id}: ${error.error}`)
		}
		if (result.errors.length > 10) {
			console.log(`  ... and ${result.errors.length - 10} more`)
		}
		console.log()
	}

	console.log('='.repeat(60))
	console.log('Done!')
	console.log(`Total time: ${importTime + writeTime}ms`)
	console.log('='.repeat(60))
}

main().catch((err) => {
	console.error('Import failed:', err)
	process.exit(1)
})
