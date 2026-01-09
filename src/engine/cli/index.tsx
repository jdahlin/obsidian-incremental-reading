#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './App.js';
import { runBatch } from './batch.js';

// Enter alternate screen buffer (like vim/less)
const enterAltScreen = '\x1b[?1049h';
const exitAltScreen = '\x1b[?1049l';
const hideCursor = '\x1b[?25l';
const showCursor = '\x1b[?25h';

const cli = meow(
	`
  Usage
    $ npx tsx src/engine/cli/index.tsx --vault <path>

  Options
    --vault, -v     Path to vault (contains IR/ folder)
    --review, -r    Go directly to review mode (optional folder substring filter)
    --deck, -d      Start with specific deck path (exact match)
    --strategy, -s  Review strategy: Anki | JD1 (default: Anki)
    --limit, -l     Max new cards per session
    --batch, -b     Run in batch mode (read commands from stdin)

  Batch mode commands:
    inspect-next [--limit N]   Show next N cards to review
    status                     Show card counts

  Examples
    $ npx tsx src/engine/cli/index.tsx --vault ~/Documents/MyVault
    $ npx tsx src/engine/cli/index.tsx -v ./Vault --review           # Review all
    $ npx tsx src/engine/cli/index.tsx -v ./Vault --review Gabriel   # Review folders matching "Gabriel"
    $ echo "inspect-next --limit 5" | npx tsx src/engine/cli/index.tsx -v ./Vault --batch
`,
	{
		importMeta: import.meta,
		flags: {
			vault: {
				type: 'string',
				shortFlag: 'v',
				isRequired: true,
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
		},
	},
);

const { vault, deck, strategy, limit, batch, review, snapshot } = cli.flags;

// --snapshot: render once with colors and exit (for debugging)
if (snapshot) {
	process.env.FORCE_COLOR = '1';
}

// Check if --review or -r was passed (even without a value)
const reviewMode = process.argv.some((arg) => arg === '--review' || arg === '-r');
const reviewFilter = review || undefined;

// Batch mode - read from stdin, output to stdout
if (batch) {
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
