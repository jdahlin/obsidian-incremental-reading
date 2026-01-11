/**
 * Card Importer
 *
 * Reads cards from Anki database with scheduling data.
 */

import type Database from 'better-sqlite3'
import type { Card, CardRow } from '../types.js'
import { getCollectionCreationTime, readCards } from '../database.js'
import { cardId, cardOrd, CardQueue, CardType, deckId, noteId } from '../types.js'

// =============================================================================
// Hydration Functions
// =============================================================================

/**
 * Convert raw card row to hydrated Card
 */
export function hydrateCard(row: CardRow): Card {
	return {
		id: cardId(row.id),
		noteId: noteId(row.nid),
		deckId: deckId(row.did),
		ord: cardOrd(row.ord),
		queue: row.queue,
		type: row.type,
		due: row.due,
		interval: row.ivl as Card['interval'],
		factor: row.factor as Card['factor'],
		reps: row.reps,
		lapses: row.lapses,
	}
}

// =============================================================================
// Import Function
// =============================================================================

/**
 * Import all cards from database
 */
export function importCards(db: Database.Database): Card[] {
	const rows = readCards(db)
	return rows.map(hydrateCard)
}

// =============================================================================
// Card Utilities
// =============================================================================

/**
 * Build a card lookup map by ID
 */
export function buildCardMap(cards: readonly Card[]): Map<number, Card> {
	const map = new Map<number, Card>()
	for (const card of cards) {
		map.set(card.id as number, card)
	}
	return map
}

/**
 * Group cards by note ID
 */
export function groupCardsByNote(cards: readonly Card[]): Map<number, Card[]> {
	const map = new Map<number, Card[]>()
	for (const card of cards) {
		const nid = card.noteId as number
		const existing = map.get(nid) ?? []
		existing.push(card)
		map.set(nid, existing)
	}
	return map
}

/**
 * Group cards by deck ID
 */
export function groupCardsByDeck(cards: readonly Card[]): Map<number, Card[]> {
	const map = new Map<number, Card[]>()
	for (const card of cards) {
		const did = card.deckId as number
		const existing = map.get(did) ?? []
		existing.push(card)
		map.set(did, existing)
	}
	return map
}

// =============================================================================
// Scheduling Conversion (Anki → FSRS)
// =============================================================================

/**
 * Scheduling status for FSRS
 */
export type SchedulingStatus = 'new' | 'learning' | 'review' | 'relearning'

/**
 * Convert Anki queue to scheduling status
 */
export function queueToStatus(queue: CardQueue, type: CardType): SchedulingStatus | null {
	switch (queue) {
		case CardQueue.New:
			return 'new'
		case CardQueue.Learning:
		case CardQueue.DayLearn:
		case CardQueue.Preview:
			return type === CardType.Relearn ? 'relearning' : 'learning'
		case CardQueue.Review:
			return 'review'
		case CardQueue.Suspended:
			// Skip suspended cards
			return null
		case CardQueue.UserBuried:
		case CardQueue.SchedBuried:
			// Reset buried cards to new
			return 'new'
		default:
			return 'new'
	}
}

/**
 * Convert Anki ease factor (permille) to FSRS difficulty (0-10)
 * Formula: (3000 - clamp(factor, 1300, 3000)) / 170
 */
export function factorToDifficulty(factor: number): number {
	if (factor === 0) return 5 // Default for new cards
	const clamped = Math.max(1300, Math.min(3000, factor))
	return (3000 - clamped) / 170
}

/**
 * Convert Anki due date to ISO string
 *
 * @param due - Due value from Anki
 * @param queue - Card queue (determines interpretation)
 * @param collectionCreatedAt - Collection creation timestamp (seconds)
 */
export function dueToDate(
	due: number,
	queue: CardQueue,
	collectionCreatedAt: number,
): Date {
	if (queue === CardQueue.New) {
		// New cards: due is position in new queue, not a date
		return new Date()
	}

	if (queue === CardQueue.Learning || queue === CardQueue.Preview) {
		// Learning cards: due is Unix timestamp in seconds
		return new Date(due * 1000)
	}

	// Review/DayLearn cards: due is days since collection creation
	const dueTimestamp = (collectionCreatedAt + due * 86400) * 1000
	return new Date(dueTimestamp)
}

/**
 * FSRS scheduling state for a card
 */
export interface FSRSSchedulingState {
	readonly status: SchedulingStatus
	readonly due: Date
	readonly stability: number // days
	readonly difficulty: number // 0-10
	readonly reps: number
	readonly lapses: number
}

/**
 * Convert Anki card to FSRS scheduling state
 */
export function cardToFSRSState(
	card: Card,
	collectionCreatedAt: number,
): FSRSSchedulingState | null {
	const status = queueToStatus(card.queue, card.type)
	if (status === null) {
		return null // Suspended card
	}

	return {
		status,
		due: dueToDate(card.due, card.queue, collectionCreatedAt),
		stability: card.interval as number,
		difficulty: factorToDifficulty(card.factor as number),
		reps: card.reps,
		lapses: card.lapses,
	}
}

/**
 * Import cards with FSRS scheduling state
 */
export function importCardsWithScheduling(
	db: Database.Database,
): { cards: Card[]; scheduling: Map<number, FSRSSchedulingState>; collectionCreatedAt: number } {
	const cards = importCards(db)
	const collectionCreatedAt = getCollectionCreationTime(db)
	const scheduling = new Map<number, FSRSSchedulingState>()

	for (const card of cards) {
		const state = cardToFSRSState(card, collectionCreatedAt)
		if (state) {
			scheduling.set(card.id as number, state)
		}
	}

	return { cards, scheduling, collectionCreatedAt }
}
