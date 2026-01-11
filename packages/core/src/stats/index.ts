// Legacy aggregations (still useful for simple calculations)
export {
	buildForecastData,
	buildHeatmapData,
	calculateAnswerDistribution,
	calculateRetention,
	calculateStreak,
} from './aggregations'

export type { AnswerDistribution, ForecastData, HeatmapData } from './aggregations'

// Database
export { createStatsDatabase, getSqlJs } from './database'

// Types
export type {
	FutureDueData,
	FutureDueReport,
	FutureDueSummary,
	RetentionPeriodData,
	RetentionReport,
	ReviewsHistoryData,
	ReviewsHistoryReport,
	ReviewsHistorySummary,
	StatsDatabase,
	StatsItemRecord,
	StatsReviewRecord,
} from './types'
