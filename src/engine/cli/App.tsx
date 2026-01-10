import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useStdout, useInput } from 'ink';
import { TerminalInfoProvider } from 'ink-picture';
import { NodeFileSystem } from './fs.js';
import { MarkdownDataStore } from '../data/MarkdownDataStore.js';
import { SessionManager } from '../SessionManager.js';
import type { SessionStrategyId } from '../types.js';
import { DeckSelect } from './screens/DeckSelect.js';
import { Review } from './screens/Review.js';
import { Stats } from './screens/Stats.js';

type Tab = 'decks' | 'stats' | 'review';

interface AppProps {
	vaultPath: string;
	initialDeck?: string;
	strategy: SessionStrategyId;
	newCardLimit?: number;
	reviewMode?: boolean;
	reviewFilter?: string;
	exitAfterRender?: boolean;
}

export function App({
	vaultPath,
	initialDeck,
	strategy,
	newCardLimit,
	reviewMode,
	reviewFilter,
	exitAfterRender,
}: AppProps) {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [tab, setTab] = useState<Tab>(initialDeck || reviewMode ? 'review' : 'decks');
	const [selectedDeck, setSelectedDeck] = useState<string | null>(initialDeck ?? null);
	const [session, setSession] = useState<SessionManager | null>(null);
	const [fs, setFs] = useState<NodeFileSystem | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [rendered, setRendered] = useState(false);

	// Exit after first render if --snapshot flag is set
	useEffect(() => {
		if (exitAfterRender && !loading && !rendered) {
			setRendered(true);
			setTimeout(() => exit(), 100);
		}
	}, [exitAfterRender, loading, rendered, exit]);

	const height = stdout?.rows ?? 24;
	const width = stdout?.columns ?? 80;

	// Initialize
	useEffect(() => {
		async function init() {
			try {
				const fileSystem = new NodeFileSystem(vaultPath);
				setFs(fileSystem);

				const dataStore = new MarkdownDataStore(fileSystem, fileSystem);
				const sessionManager = new SessionManager(dataStore, fileSystem, {
					strategy,
					mode: 'review',
					schedulerId: 'fsrs',
					capacity: newCardLimit,
				});

				await sessionManager.loadPool();
				setSession(sessionManager);
				setLoading(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
				setLoading(false);
			}
		}
		void init();
	}, [vaultPath, strategy, newCardLimit]);

	// Tab navigation and quit (disabled in --snapshot mode)
	useInput(
		(input, key) => {
			// Quit always works
			if (input === 'q' || key.escape) {
				exit();
				return;
			}

			// Tab switching with letter keys
			if (input === 'd') {
				setTab('decks');
			} else if (input === 's') {
				setTab('stats');
			} else if (input === 'r') {
				setTab('review');
			}
		},
		{ isActive: !exitAfterRender },
	);

	const handleDeckSelect = (deckPath: string) => {
		setSelectedDeck(deckPath);
		setTab('review');
	};

	const handleQuit = () => {
		exit();
	};

	const renderTabBar = () => (
		<Box borderStyle="single" borderBottom paddingX={1}>
			<Text>
				<Text inverse={tab === 'decks'}> [d]ecks </Text>
				{'  '}
				<Text inverse={tab === 'stats'}> [s]tats </Text>
				{'  '}
				<Text inverse={tab === 'review'}> [r]eview </Text>
				<Text color="gray">{'  '}[q]uit</Text>
			</Text>
		</Box>
	);

	const renderContent = () => {
		if (error) {
			return (
				<Box flexDirection="column" padding={1}>
					<Text color="red">Error: {error}</Text>
					<Text color="gray">Press q or Esc to quit</Text>
				</Box>
			);
		}

		if (loading || !session || !fs) {
			return (
				<Box flexDirection="column" padding={1}>
					<Text>Loading...</Text>
					<Text color="gray">Press q or Esc to quit</Text>
				</Box>
			);
		}

		switch (tab) {
			case 'decks':
				return (
					<DeckSelect
						session={session}
						vaultPath={vaultPath}
						onSelect={handleDeckSelect}
						onQuit={handleQuit}
					/>
				);
			case 'stats':
				return <Stats session={session} vaultPath={vaultPath} />;
			case 'review':
				return (
					<Review
						session={session}
						vaultPath={vaultPath}
						deckPath={selectedDeck}
						deckFilter={reviewFilter}
						onQuit={handleQuit}
						disableInput={exitAfterRender}
					/>
				);
		}
	};

	const content = (
		<Box flexDirection="column" width={width} height={height}>
			{renderTabBar()}
			<Box flexDirection="column" flexGrow={1}>
				{renderContent()}
			</Box>
		</Box>
	);

	// Skip TerminalInfoProvider in snapshot mode (requires raw mode for terminal detection)
	if (exitAfterRender) {
		return content;
	}

	return <TerminalInfoProvider>{content}</TerminalInfoProvider>;
}
