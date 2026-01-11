/**
 * Stats Report Types
 *
 * These types define the data structures returned by stats reports.
 * Frontend implementations render these without needing to know SQL.
 */

// =============================================================================
// Future Due Report
// =============================================================================

export interface FutureDueData {
	daysFromNow: number
	count: number
	cumulative: number
	/** For day 0: just today's due count (excluding overdue backlog) */
	todayOnly?: number
	/** For day 0: overdue backlog count */
	backlog?: number
}

export interface FutureDueSummary {
	total: number
	average: number
	dueTomorrow: number
	dailyLoad: number
}

export interface FutureDueReport {
	data: FutureDueData[]
	summary: FutureDueSummary
}

// =============================================================================
// Reviews History Report
// =============================================================================

export interface ReviewsHistoryData {
	daysAgo: number
	learning: number
	young: number
	mature: number
	relearning: number
	total: number
	cumulative: number
}

export interface ReviewsHistorySummary {
	daysStudied: number
	totalDays: number
	totalReviews: number
	avgPerPeriod: number
	avgPerStudyDay: number
}

export interface ReviewsHistoryReport {
	data: ReviewsHistoryData[]
	summary: ReviewsHistorySummary
}

// =============================================================================
// Retention Report
// =============================================================================

export interface RetentionPeriodData {
	period: string
	youngRetention: number | null
	matureRetention: number | null
	totalRetention: number | null
	count: number
}

export interface RetentionReport {
	data: RetentionPeriodData[]
	targetRetention: number
}

// =============================================================================
// Stats Database Interface
// =============================================================================

export interface StatsDatabase {
	/** Get future due report for N days */
	getFutureDueReport: (days: number) => FutureDueReport

	/** Get reviews history report for N days */
	getReviewsHistoryReport: (days: number) => ReviewsHistoryReport

	/** Get retention report */
	getRetentionReport: (targetRetention: number) => RetentionReport

	/** Close the database connection */
	close: () => void
}

// =============================================================================
// Input Types (for creating stats database)
// =============================================================================

export interface StatsReviewRecord {
	ts: string
	item_id: string
	rating: 1 | 2 | 3 | 4
	elapsed_ms?: number
	state_before?: 'new' | 'learning' | 'review' | 'relearning'
	stability_before?: number
	difficulty_before?: number
}

export interface StatsItemRecord {
	id: string
	status: 'new' | 'learning' | 'review' | 'relearning'
	due: Date | null
	stability: number
	difficulty: number
	reps: number
	lapses: number
}
