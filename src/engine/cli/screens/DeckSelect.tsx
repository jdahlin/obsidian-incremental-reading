import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionManager } from '../../SessionManager.js';

interface DeckInfo {
	path: string;
	name: string;
	depth: number;
	counts: { new: number; learning: number; due: number };
}

interface DeckSelectProps {
	session: SessionManager;
	vaultPath: string;
	onSelect: (deckPath: string) => void;
	onQuit: () => void;
}

export function DeckSelect({ session, onSelect }: DeckSelectProps) {
	const [decks, setDecks] = useState<DeckInfo[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadDecks() {
			const items = await session.getNextN(10000);

			const deckMap = new Map<string, DeckInfo>();

			// Add root deck
			deckMap.set('', {
				path: '',
				name: 'All',
				depth: 0,
				counts: { new: 0, learning: 0, due: 0 },
			});

			const now = new Date();

			for (const si of items) {
				const notePath = si.item.notePath;
				const folder = getFolderPath(notePath);

				const segments = folder ? folder.split('/') : [];
				for (let i = 0; i <= segments.length; i++) {
					const deckPath = segments.slice(0, i).join('/');
					if (!deckMap.has(deckPath)) {
						deckMap.set(deckPath, {
							path: deckPath,
							name: deckPath ? segments[i - 1] || deckPath : 'All',
							depth: i,
							counts: { new: 0, learning: 0, due: 0 },
						});
					}

					const deck = deckMap.get(deckPath)!;
					if (si.state.status === 'new') {
						deck.counts.new++;
					} else if (si.state.status === 'learning' || si.state.status === 'relearning') {
						deck.counts.learning++;
					} else if (si.state.due && si.state.due <= now) {
						deck.counts.due++;
					}
				}
			}

			const sortedDecks = Array.from(deckMap.values()).sort((a, b) =>
				a.path.localeCompare(b.path),
			);

			setDecks(sortedDecks);
			setLoading(false);
		}

		void loadDecks();
	}, [session]);

	useInput((input, key) => {
		// Don't handle if meta/ctrl (let App handle tab switching)
		if (key.meta || key.ctrl) return;

		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(decks.length - 1, prev + 1));
		} else if (key.return) {
			const selected = decks[selectedIndex];
			if (selected) {
				onSelect(selected.path);
			}
		}
	});

	if (loading) {
		return (
			<Box padding={1}>
				<Text>Loading decks...</Text>
			</Box>
		);
	}

	if (decks.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">No review items found.</Text>
				<Text color="gray">Make sure your vault has IR/Review Items/ sidecar files.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold>Select a deck</Text>
				<Text color="gray"> (↑↓ navigate, Enter select)</Text>
			</Box>

			{decks.map((deck, index) => {
				const isSelected = index === selectedIndex;
				const indent = '  '.repeat(deck.depth);
				const total = deck.counts.new + deck.counts.learning + deck.counts.due;

				return (
					<Box key={deck.path || 'root'}>
						<Text inverse={isSelected}>
							{isSelected ? '❯ ' : '  '}
							{indent}
							{deck.name}
							{'  '}
							<Text color="blue">{deck.counts.new}</Text>
							{'/'}
							<Text color="yellow">{deck.counts.learning}</Text>
							{'/'}
							<Text color="green">{deck.counts.due}</Text>
							<Text color="gray"> ({total})</Text>
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}

function getFolderPath(notePath: string): string {
	const segments = notePath.split('/');
	if (segments.length <= 1) return '';
	return segments.slice(0, -1).join('/');
}
