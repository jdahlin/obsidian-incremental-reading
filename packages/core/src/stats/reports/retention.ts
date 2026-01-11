/**
 * Retention Report
 *
 * Shows pass rate of cards with interval >= 1 day, broken down by maturity.
 */

import type { Database } from 'sql.js'
import type { RetentionPeriodData, RetentionReport } from '../types'

export function getRetentionReport(db: Database, targetRetention: number): RetentionReport {
	const data = getRetentionData(db)

	return { data, targetRetention }
}

function getRetentionData(db: Database): RetentionPeriodData[] {
	const results: RetentionPeriodData[] = []
	const today = new Date()

	// Helper to calculate retention for a date range
	const calcRetention = (
		startDate: string,
		endDate: string,
	): { young: number | null; mature: number | null; total: number | null; count: number } => {
		const stmt = db.prepare(`
			SELECT
				SUM(CASE WHEN stability_before < 21 AND rating > 1 THEN 1 ELSE 0 END) as young_pass,
				SUM(CASE WHEN stability_before < 21 THEN 1 ELSE 0 END) as young_total,
				SUM(CASE WHEN stability_before >= 21 AND rating > 1 THEN 1 ELSE 0 END) as mature_pass,
				SUM(CASE WHEN stability_before >= 21 THEN 1 ELSE 0 END) as mature_total,
				SUM(CASE WHEN rating > 1 THEN 1 ELSE 0 END) as total_pass,
				COUNT(*) as total_count
			FROM reviews
			WHERE date(ts) >= date(?) AND date(ts) <= date(?)
				AND state_before IN ('review', 'relearning')
		`)
		stmt.bind([startDate, endDate])
		stmt.step()
		const row = stmt.getAsObject() as Record<string, number | null>
		stmt.free()

		const youngTotal = row.young_total ?? 0
		const matureTotal = row.mature_total ?? 0
		const totalCount = row.total_count ?? 0

		return {
			young: youngTotal > 0 ? ((row.young_pass ?? 0) / youngTotal) * 100 : null,
			mature: matureTotal > 0 ? ((row.mature_pass ?? 0) / matureTotal) * 100 : null,
			total: totalCount > 0 ? ((row.total_pass ?? 0) / totalCount) * 100 : null,
			count: totalCount,
		}
	}

	// Today
	const todayStr = formatDate(today)
	const todayData = calcRetention(todayStr, todayStr)
	results.push({
		period: 'Today',
		youngRetention: todayData.young,
		matureRetention: todayData.mature,
		totalRetention: todayData.total,
		count: todayData.count,
	})

	// Yesterday
	const yesterday = new Date(today)
	yesterday.setDate(yesterday.getDate() - 1)
	const yesterdayStr = formatDate(yesterday)
	const yesterdayData = calcRetention(yesterdayStr, yesterdayStr)
	results.push({
		period: 'Yesterday',
		youngRetention: yesterdayData.young,
		matureRetention: yesterdayData.mature,
		totalRetention: yesterdayData.total,
		count: yesterdayData.count,
	})

	// Last week
	const weekAgo = new Date(today)
	weekAgo.setDate(weekAgo.getDate() - 7)
	const weekData = calcRetention(formatDate(weekAgo), todayStr)
	results.push({
		period: 'Last week',
		youngRetention: weekData.young,
		matureRetention: weekData.mature,
		totalRetention: weekData.total,
		count: weekData.count,
	})

	// Last month
	const monthAgo = new Date(today)
	monthAgo.setDate(monthAgo.getDate() - 30)
	const monthData = calcRetention(formatDate(monthAgo), todayStr)
	results.push({
		period: 'Last month',
		youngRetention: monthData.young,
		matureRetention: monthData.mature,
		totalRetention: monthData.total,
		count: monthData.count,
	})

	// Last year
	const yearAgo = new Date(today)
	yearAgo.setFullYear(yearAgo.getFullYear() - 1)
	const yearData = calcRetention(formatDate(yearAgo), todayStr)
	results.push({
		period: 'Last year',
		youngRetention: yearData.young,
		matureRetention: yearData.mature,
		totalRetention: yearData.total,
		count: yearData.count,
	})

	return results
}

function formatDate(date: Date): string {
	const iso = date.toISOString()
	return iso.substring(0, iso.indexOf('T'))
}
