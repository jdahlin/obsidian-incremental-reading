/**
 * Stats Database
 *
 * Uses sql.js (WebAssembly SQLite) to store and query review statistics.
 * Database is created in-memory and populated from review/item records.
 */

import type { Database, SqlJsStatic } from 'sql.js'
import type {
	FutureDueReport,
	RetentionReport,
	ReviewsHistoryReport,
	StatsDatabase,
	StatsItemRecord,
	StatsReviewRecord,
} from './types'
// Use asm.js version - pure JavaScript, no WASM loading needed
// This works in all environments (Node.js, Electron, browser)
import initSqlJs from 'sql.js/dist/sql-asm.js'
import { getFutureDueReport } from './reports/future-due'
import { getRetentionReport } from './reports/retention'
import { getReviewsHistoryReport } from './reports/reviews-history'

let sqlPromise: Promise<SqlJsStatic> | null = null

/**
 * Get or initialize sql.js
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
	if (!sqlPromise) {
		// sql-asm.js doesn't need locateFile - it's pure JavaScript
		sqlPromise = initSqlJs()
	}
	return sqlPromise
}

/**
 * Create a stats database from review and item records
 */
export async function createStatsDatabase(
	reviews: StatsReviewRecord[],
	items: StatsItemRecord[],
): Promise<StatsDatabase> {
	const SQL = await getSqlJs()
	const db = new SQL.Database()

	// Create tables
	createTables(db)

	// Insert data
	insertReviews(db, reviews)
	insertItems(db, items)

	// Return database with report methods
	return {
		getFutureDueReport(days: number): FutureDueReport {
			return getFutureDueReport(db, days)
		},

		getReviewsHistoryReport(days: number): ReviewsHistoryReport {
			return getReviewsHistoryReport(db, days)
		},

		getRetentionReport(targetRetention: number): RetentionReport {
			return getRetentionReport(db, targetRetention)
		},

		close(): void {
			db.close()
		},
	}
}

// =============================================================================
// Internal Functions
// =============================================================================

function createTables(db: Database): void {
	db.run(`
		CREATE TABLE reviews (
			ts TEXT NOT NULL,
			item_id TEXT NOT NULL,
			rating INTEGER NOT NULL,
			elapsed_ms INTEGER,
			state_before TEXT,
			stability_before REAL,
			difficulty_before REAL
		)
	`)

	db.run(`
		CREATE TABLE items (
			id TEXT PRIMARY KEY,
			status TEXT NOT NULL,
			due TEXT,
			stability REAL,
			difficulty REAL,
			reps INTEGER,
			lapses INTEGER
		)
	`)

	// Create indexes for common queries
	db.run('CREATE INDEX idx_reviews_ts ON reviews(ts)')
	db.run('CREATE INDEX idx_reviews_item ON reviews(item_id)')
	db.run('CREATE INDEX idx_items_due ON items(due)')
	db.run('CREATE INDEX idx_items_status ON items(status)')
}

function insertReviews(db: Database, reviews: StatsReviewRecord[]): void {
	const stmt = db.prepare(`
		INSERT INTO reviews (ts, item_id, rating, elapsed_ms, state_before, stability_before, difficulty_before)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)

	for (const review of reviews) {
		// Skip reviews with missing required fields
		if (!review.ts || !review.item_id || review.rating == null) continue

		stmt.run([
			review.ts,
			review.item_id,
			review.rating,
			review.elapsed_ms ?? null,
			review.state_before ?? null,
			review.stability_before ?? null,
			review.difficulty_before ?? null,
		])
	}

	stmt.free()
}

function insertItems(db: Database, items: StatsItemRecord[]): void {
	const stmt = db.prepare(`
		INSERT INTO items (id, status, due, stability, difficulty, reps, lapses)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)

	for (const item of items) {
		// Skip items with missing required fields
		if (!item.id || !item.status) continue

		stmt.run([
			item.id,
			item.status,
			item.due?.toISOString() ?? null,
			item.stability ?? 0,
			item.difficulty ?? 0,
			item.reps ?? 0,
			item.lapses ?? 0,
		])
	}

	stmt.free()
}
