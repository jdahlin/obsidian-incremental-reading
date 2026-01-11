#!/usr/bin/env node

import meow from 'meow'

// Enter alternate screen buffer (like vim/less)
const enterAltScreen = '\x1B[?1049h'
const exitAltScreen = '\x1B[?1049l'
const hideCursor = '\x1B[?25l'
const showCursor = '\x1B[?25h'

const cli = meow(
	`
  Usage
    $ pnpm cli [options]

  Options
    --vault, -v     Path to vault (default: ./vault)
    --review, -r    Go directly to review mode (optional folder substring filter)
    --deck, -d      Start with specific deck path (exact match)
    --strategy, -s  Review strategy: Anki | JD1 (default: Anki)
    --limit, -l     Max new cards per session
    --batch, -b     Run in batch mode (read commands from stdin)
    --import, -i    Import from Anki
    --import-path   Custom Anki profile path (default: auto-detect)
    --deck-filter   Filter decks to import (e.g., "AH del 2*")

  Batch mode commands:
    inspect-next [--limit N]   Show next N cards to review
    status                     Show card counts

  Examples
    $ pnpm cli                                       # Interactive mode
    $ pnpm cli --review                              # Review all
    $ pnpm cli --review Gabriel                      # Review folders matching "Gabriel"
    $ pnpm cli --import                              # Import all from Anki
    $ pnpm cli --import --deck-filter "AH del 2*"   # Import matching decks
    $ echo "status" | pnpm cli --batch
`,
	{
		importMeta: import.meta,
		flags: {
			vault: {
				type: 'string',
				shortFlag: 'v',
				default: './vault',
			},
			review: {
				type: 'string',
				shortFlag: 'r',
			},
			deck: {
				type: 'string',
				shortFlag: 'd',
			},
			strategy: {
				type: 'string',
				shortFlag: 's',
				default: 'Anki',
			},
			limit: {
				type: 'number',
				shortFlag: 'l',
			},
			batch: {
				type: 'boolean',
				shortFlag: 'b',
				default: false,
			},
			snapshot: {
				type: 'boolean',
				default: false,
			},
			import: {
				type: 'boolean',
				shortFlag: 'i',
				default: false,
			},
			importPath: {
				type: 'string',
				description: 'Custom Anki profile path (defaults to standard location)',
			},
			deckFilter: {
				type: 'string',
			},
		},
	},
)

const {
	vault,
	deck,
	strategy,
	limit,
	batch,
	review,
	snapshot,
	import: doImport,
	importPath,
	deckFilter: _deckFilter, // TODO: implement deck filtering
} = cli.flags

// --snapshot: render once with colors and exit (for debugging)
if (snapshot) {
	process.env.FORCE_COLOR = '1'
}

// Check if --review or -r was passed (even without a value)
const reviewMode = process.argv.some((arg) => arg === '--review' || arg === '-r')
const reviewFilter = review !== undefined && review !== '' ? review : undefined

// Main entry point - wrapped in async IIFE for lazy loading
void (async () => {
	// Import mode - import from Anki and exit
	if (doImport) {
		// Lazy load the anki-importer to avoid loading it when not needed
		const { importAnkiDatabase, writeAnkiData, getCollectionCreationTime, openAnkiDatabase } =
			await import('@repo/anki-importer')
		const path = await import('node:path')
		const os = await import('node:os')

		// Default Anki path
		const defaultAnkiPath = path.join(os.homedir(), 'Library/Application Support/Anki2/User 1')
		const ankiProfilePath = importPath ?? defaultAnkiPath
		const ankiDbPath = path.join(ankiProfilePath, 'collection.anki2')
		const ankiMediaPath = path.join(ankiProfilePath, 'collection.media')
		const outputDir = path.join(vault, 'Anki')
		const sidecarDir = path.join(vault, 'IR/Review Items')

		console.log('Importing from Anki...')
		console.log(`  Source: ${ankiDbPath}`)
		console.log(`  Notes:  ${outputDir}`)
		console.log(`  Cards:  ${sidecarDir}`)
		console.log()

		try {
			// Import data from Anki
			const data = importAnkiDatabase(ankiDbPath)

			console.log('Import Statistics:')
			console.log(`  Models:  ${data.stats.modelCount}`)
			console.log(`  Decks:   ${data.stats.deckCount}`)
			console.log(`  Notes:   ${data.stats.noteCount}`)
			console.log(`  Cards:   ${data.stats.cardCount}`)
			console.log()

			// Get collection creation time for scheduling
			const db = openAnkiDatabase(ankiDbPath)
			const collectionCreatedAt = getCollectionCreationTime(db)
			db.close()

			// Write to markdown
			console.log('Writing markdown files...')
			const result = await writeAnkiData(data, {
				outputDir,
				sidecarDir,
				vaultRelativePrefix: 'Anki',
				mediaDir: ankiMediaPath,
				collectionCreatedAt,
			})

			console.log('\nWrite Statistics:')
			console.log(`  Models:  ${result.modelsWritten}`)
			console.log(`  Notes:   ${result.notesWritten}`)
			console.log(`  Cards:   ${result.cardsWritten}`)
			console.log(`  Decks:   ${result.decksWritten}`)
			console.log(`  Media:   ${result.mediaWritten}`)

			if (result.errors.length > 0) {
				console.log(`  Errors:  ${result.errors.length}`)
			}

			console.log('\nDone!')
			process.exit(0)
		} catch (err) {
			console.error('Import failed:', err instanceof Error ? err.message : err)
			process.exit(1)
		}
	} else if (batch) {
		// Batch mode - read from stdin, output to stdout
		const { runBatch } = await import('./batch.js')

		let input = ''
		process.stdin.setEncoding('utf8')
		process.stdin.on('data', (chunk: string) => {
			input += chunk
		})
		process.stdin.on('end', () => {
			void runBatch(vault, input, strategy as 'Anki' | 'JD1').then((output) => {
				process.stdout.write(output)
			})
		})
	} else {
		// Interactive mode - lazy load ink and React
		const { render } = await import('ink')
		const React = await import('react')
		const { App } = await import('./App.js')

		// Enter full screen mode (unless snapshot)
		if (!snapshot) {
			process.stdout.write(enterAltScreen + hideCursor)
		}

		// Cleanup on exit
		const cleanup = () => {
			if (!snapshot) {
				process.stdout.write(showCursor + exitAltScreen)
			}
		}
		process.on('exit', cleanup)
		process.on('SIGINT', () => {
			cleanup()
			process.exit(0)
		})
		process.on('SIGTERM', () => {
			cleanup()
			process.exit(0)
		})

		void render(
			React.createElement(App, {
				vaultPath: vault,
				initialDeck: deck,
				strategy: strategy as 'Anki' | 'JD1',
				newCardLimit: limit,
				reviewMode,
				reviewFilter,
				exitAfterRender: snapshot,
			}),
			{ exitOnCtrlC: true },
		)
			.waitUntilExit()
			.then(() => {
				cleanup()
			})
	}
})()
