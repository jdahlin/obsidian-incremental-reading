/**
 * Future Due Report
 *
 * Shows the number of reviews due in the future, with cumulative totals.
 * Backlog (overdue items) is shown distributed across negative days like Anki.
 */

import type { Database } from 'sql.js'
import type { FutureDueData, FutureDueReport, FutureDueSummary } from '../types'

export function getFutureDueReport(db: Database, days: number): FutureDueReport {
	const data = getFutureDueData(db, days)
	const summary = calculateSummary(data, days)

	return { data, summary }
}

function getFutureDueData(db: Database, days: number): FutureDueData[] {
	const results: FutureDueData[] = []
	const today = new Date()
	today.setHours(0, 0, 0, 0)

	// First, get the oldest overdue date to know how far back to go
	const oldestStmt = db.prepare(`
		SELECT MIN(date(due)) as oldest_date
		FROM items
		WHERE due IS NOT NULL AND date(due) < date('now')
	`)
	oldestStmt.step()
	const oldestRow = oldestStmt.getAsObject() as { oldest_date: string | null }
	oldestStmt.free()

	// Calculate how many days of backlog we have
	let backlogDays = 0
	if (oldestRow.oldest_date !== null && oldestRow.oldest_date !== '') {
		const oldestDate = new Date(`${oldestRow.oldest_date}T00:00:00`)
		backlogDays = Math.ceil((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
		// Cap backlog display at same range as future (for symmetry)
		backlogDays = Math.min(backlogDays, days)
	}

	// Build data from oldest backlog day to future
	let cumulative = 0

	// First pass: collect counts for all days (backlog + future)
	const dayCounts: Array<{ daysFromNow: number; count: number }> = []

	// Backlog days (negative)
	for (let i = -backlogDays; i < 0; i++) {
		const targetDate = new Date(today)
		targetDate.setDate(targetDate.getDate() + i)
		const dateStr = formatDateForSql(targetDate)

		const stmt = db.prepare(`
			SELECT COUNT(*) as count
			FROM items
			WHERE due IS NOT NULL AND date(due) = date(?)
		`)
		stmt.bind([dateStr])
		stmt.step()
		const row = stmt.getAsObject() as { count: number }
		stmt.free()

		dayCounts.push({ daysFromNow: i, count: row.count })
	}

	// Today (day 0)
	const todayStmt = db.prepare(`
		SELECT COUNT(*) as count
		FROM items
		WHERE due IS NOT NULL AND date(due) = date('now')
	`)
	todayStmt.step()
	const todayRow = todayStmt.getAsObject() as { count: number }
	todayStmt.free()
	dayCounts.push({ daysFromNow: 0, count: todayRow.count })

	// Future days (positive)
	for (let i = 1; i <= days; i++) {
		const targetDate = new Date(today)
		targetDate.setDate(targetDate.getDate() + i)
		const dateStr = formatDateForSql(targetDate)

		const stmt = db.prepare(`
			SELECT COUNT(*) as count
			FROM items
			WHERE due IS NOT NULL AND date(due) = date(?)
		`)
		stmt.bind([dateStr])
		stmt.step()
		const row = stmt.getAsObject() as { count: number }
		stmt.free()

		dayCounts.push({ daysFromNow: i, count: row.count })
	}

	// Calculate total backlog for metadata
	const totalBacklog = dayCounts
		.filter((d) => d.daysFromNow < 0)
		.reduce((sum, d) => sum + d.count, 0)

	// Build results with cumulative totals
	for (const dayData of dayCounts) {
		cumulative += dayData.count

		const entry: FutureDueData = {
			daysFromNow: dayData.daysFromNow,
			count: dayData.count,
			cumulative,
		}

		// Add metadata for day 0
		if (dayData.daysFromNow === 0) {
			entry.todayOnly = dayData.count
			entry.backlog = totalBacklog
		}

		results.push(entry)
	}

	return results
}

function calculateSummary(data: FutureDueData[], days: number): FutureDueSummary {
	// Total includes backlog + future
	const total = data.reduce((sum, d) => sum + d.count, 0)
	const dueTomorrow = data.find((d) => d.daysFromNow === 1)?.count ?? 0

	// Daily load = average of future days only (excluding backlog)
	const futureDays = data.filter((d) => d.daysFromNow > 0)
	const futureTotal = futureDays.reduce((sum, d) => sum + d.count, 0)
	const dailyLoad = futureDays.length > 0 ? Math.round(futureTotal / futureDays.length) : 0

	return {
		total,
		average: days > 0 ? Math.round(total / days) : 0,
		dueTomorrow,
		dailyLoad,
	}
}

function formatDateForSql(date: Date): string {
	const iso = date.toISOString()
	return iso.substring(0, iso.indexOf('T'))
}
