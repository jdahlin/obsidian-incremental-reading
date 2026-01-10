#!/usr/bin/env node

import { getDefaultAnkiPath, importAnkiDatabase } from '@repo/core/anki';
import { render } from 'ink';
import meow from 'meow';
import React from 'react';
import { App } from './App.js';
import { runBatch } from './batch.js';

// Enter alternate screen buffer (like vim/less)
const enterAltScreen = '\x1B[?1049h';
const exitAltScreen = '\x1B[?1049l';
const hideCursor = '\x1B[?25l';
const showCursor = '\x1B[?25h';

const cli = meow(
	`
  Usage
    $ pnpm cli --vault <path>

  Options
    --vault, -v     Path to vault (contains IR/ folder)
    --review, -r    Go directly to review mode (optional folder substring filter)
    --deck, -d      Start with specific deck path (exact match)
    --strategy, -s  Review strategy: Anki | JD1 (default: Anki)
    --limit, -l     Max new cards per session
    --batch, -b     Run in batch mode (read commands from stdin)
    --import, -i    Import from Anki (path to profile or 'default')
    --deck-filter   Filter decks to import (e.g., "AH del 2*")

  Batch mode commands:
    inspect-next [--limit N]   Show next N cards to review
    status                     Show card counts

  Examples
    $ pnpm cli --vault ~/Documents/MyVault
    $ pnpm cli -v ./Vault --review                              # Review all
    $ pnpm cli -v ./Vault --review Gabriel                      # Review folders matching "Gabriel"
    $ pnpm cli -v ./Vault --import default                      # Import from default Anki profile
    $ pnpm cli -v ./Vault --import default --deck-filter "AH*"  # Import decks matching "AH*"
    $ echo "status" | pnpm cli -v ./Vault --batch
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
				type: 'string',
				shortFlag: 'i',
			},
			deckFilter: {
				type: 'string',
			},
		},
	},
);

const {
	vault,
	deck,
	strategy,
	limit,
	batch,
	review,
	snapshot,
	import: importPath,
	deckFilter,
} = cli.flags;

// --snapshot: render once with colors and exit (for debugging)
if (snapshot) {
	process.env.FORCE_COLOR = '1';
}

// Check if --review or -r was passed (even without a value)
const reviewMode = process.argv.some((arg) => arg === '--review' || arg === '-r');
const reviewFilter = review !== undefined && review !== '' ? review : undefined;

// Import mode - import from Anki and exit
if (importPath !== undefined && importPath !== '') {
	const ankiProfilePath = importPath === 'default' ? getDefaultAnkiPath() : importPath;

	void importAnkiDatabase({
		ankiProfilePath,
		vaultPath: vault,
		deckFilter,
	})
		.then((result) => {
			console.log('\nImport Summary:');
			console.log(`  Notes imported: ${result.notesImported}`);
			console.log(`  Media files copied: ${result.mediaFilesCopied}`);
			if (result.mediaMissing.length > 0) {
				console.log(`  Media files missing: ${result.mediaMissing.length}`);
			}
			process.exit(0);
		})
		.catch((err: Error) => {
			console.error('Import failed:', err.message);
			process.exit(1);
		});
} else if (batch) {
	// Batch mode - read from stdin, output to stdout
	let input = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', (chunk: string) => {
		input += chunk;
	});
	process.stdin.on('end', () => {
		void runBatch(vault, input, strategy as 'Anki' | 'JD1').then((output) => {
			process.stdout.write(output);
		});
	});
} else {
	// Interactive mode
	// Enter full screen mode (unless snapshot)
	if (!snapshot) {
		process.stdout.write(enterAltScreen + hideCursor);
	}

	// Cleanup on exit
	const cleanup = () => {
		if (!snapshot) {
			process.stdout.write(showCursor + exitAltScreen);
		}
	};
	process.on('exit', cleanup);
	process.on('SIGINT', () => {
		cleanup();
		process.exit(0);
	});
	process.on('SIGTERM', () => {
		cleanup();
		process.exit(0);
	});

	void render(
		<App
			vaultPath={vault}
			initialDeck={deck}
			strategy={strategy as 'Anki' | 'JD1'}
			newCardLimit={limit}
			reviewMode={reviewMode}
			reviewFilter={reviewFilter}
			exitAfterRender={snapshot}
		/>,
		{ exitOnCtrlC: true },
	)
		.waitUntilExit()
		.then(() => {
			cleanup();
		});
}
