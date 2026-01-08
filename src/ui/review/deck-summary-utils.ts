import type { DeckInfo } from '../../core/types';

export function rowClass(selected: boolean): string {
	return `ir-deck-row${selected ? ' is-selected' : ''}`;
}

export function flattenDecks(decks: DeckInfo[]): DeckInfo[] {
	const rows: DeckInfo[] = [];
	const walk = (nodes: DeckInfo[]): void => {
		for (const node of nodes) {
			rows.push(node);
			if (node.children.length) walk(node.children);
		}
	};
	walk(decks);
	return rows;
}
