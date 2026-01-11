/**
 * Reviews History Report
 *
 * Shows the number of reviews completed over time, broken down by card state.
 */

import type { Database } from 'sql.js'
import type { ReviewsHistoryData, ReviewsHistoryReport, ReviewsHistorySummary } from '../types'

export function getReviewsHistoryReport(db: Database, days: number): ReviewsHistoryReport {
	const data = getReviewsHistoryData(db, days)
	const summary = calculateSummary(db, days)

	return { data, summary }
}

function getReviewsHistoryData(db: Database, days: number): ReviewsHistoryData[] {
	const results: ReviewsHistoryData[] = []
	let cumulative = 0

	for (let i = days; i >= 0; i--) {
		const stmt = db.prepare(`
			SELECT
				SUM(CASE WHEN state_before = 'learning' THEN 1 ELSE 0 END) as learning,
				SUM(CASE WHEN state_before = 'review' AND stability_before < 21 THEN 1 ELSE 0 END) as young,
				SUM(CASE WHEN state_before = 'review' AND stability_before >= 21 THEN 1 ELSE 0 END) as mature,
				SUM(CASE WHEN state_before = 'relearning' THEN 1 ELSE 0 END) as relearning,
				COUNT(*) as total
			FROM reviews
			WHERE date(ts) = date('now', '-' || ? || ' days')
		`)
		stmt.bind([i])
		stmt.step()
		const row = stmt.getAsObject() as Record<string, number | null>
		stmt.free()

		const total = (row.total as number) ?? 0
		cumulative += total

		results.push({
			daysAgo: -i,
			learning: (row.learning as number) ?? 0,
			young: (row.young as number) ?? 0,
			mature: (row.mature as number) ?? 0,
			relearning: (row.relearning as number) ?? 0,
			total,
			cumulative,
		})
	}

	return results
}

function calculateSummary(db: Database, days: number): ReviewsHistorySummary {
	const stmt = db.prepare(`
		SELECT
			COUNT(DISTINCT date(ts)) as days_studied,
			COUNT(*) as total_reviews
		FROM reviews
		WHERE date(ts) >= date('now', '-' || ? || ' days')
	`)
	stmt.bind([days])
	stmt.step()
	const row = stmt.getAsObject() as { days_studied: number; total_reviews: number }
	stmt.free()

	const daysStudied = row.days_studied ?? 0
	const totalReviews = row.total_reviews ?? 0

	return {
		daysStudied,
		totalDays: days,
		totalReviews,
		avgPerPeriod: days > 0 ? Math.round(totalReviews / days) : 0,
		avgPerStudyDay: daysStudied > 0 ? Math.round(totalReviews / daysStudied) : 0,
	}
}
