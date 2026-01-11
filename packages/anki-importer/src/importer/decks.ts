/**
 * Deck Importer
 *
 * Reads deck hierarchy from Anki database.
 */

import type Database from 'better-sqlite3'
import type { Deck, DeckRow } from '../types.js'
import { readDecks } from '../database.js'
import { deckId, parseDeckPath } from '../types.js'

// =============================================================================
// Hydration Functions
// =============================================================================

/**
 * Convert raw deck row to hydrated Deck
 */
export function hydrateDeck(row: DeckRow): Deck {
	// Anki uses \x1f as hierarchy separator in some versions, normalize to ::
	const normalizedName = row.name.replace(/\x1F/g, '::')

	return {
		id: deckId(row.id),
		name: normalizedName,
		pathSegments: parseDeckPath(normalizedName),
	}
}

// =============================================================================
// Import Function
// =============================================================================

/**
 * Import all decks from database
 */
export function importDecks(db: Database.Database): Deck[] {
	const rows = readDecks(db)
	return rows.map(hydrateDeck)
}

// =============================================================================
// Deck Utilities
// =============================================================================

/**
 * Build a deck lookup map by ID
 */
export function buildDeckMap(decks: readonly Deck[]): Map<number, Deck> {
	const map = new Map<number, Deck>()
	for (const deck of decks) {
		map.set(deck.id as number, deck)
	}
	return map
}

/**
 * Get the filesystem path for a deck
 * Converts "Parent::Child::Grandchild" → "Parent/Child/Grandchild"
 */
export function getDeckPath(deck: Deck): string {
	return deck.pathSegments.join('/')
}

/**
 * Build deck hierarchy tree
 */
export interface DeckTreeNode {
	readonly deck: Deck
	readonly children: DeckTreeNode[]
}

/**
 * Build a tree structure from flat deck list
 */
export function buildDeckTree(decks: readonly Deck[]): DeckTreeNode[] {
	// Sort by path depth and name for consistent ordering
	const sorted = [...decks].sort((a, b) => {
		if (a.pathSegments.length !== b.pathSegments.length) {
			return a.pathSegments.length - b.pathSegments.length
		}
		return a.name.localeCompare(b.name)
	})

	const roots: DeckTreeNode[] = []
	const nodeByPath = new Map<string, DeckTreeNode>()

	for (const deck of sorted) {
		const node: DeckTreeNode = { deck, children: [] }
		nodeByPath.set(deck.name, node)

		if (deck.pathSegments.length === 1) {
			// Root deck
			roots.push(node)
		} else {
			// Find parent
			const parentPath = deck.pathSegments.slice(0, -1).join('::')
			const parent = nodeByPath.get(parentPath)
			if (parent) {
				parent.children.push(node)
			} else {
				// Orphan deck (parent doesn't exist), treat as root
				roots.push(node)
			}
		}
	}

	return roots
}
