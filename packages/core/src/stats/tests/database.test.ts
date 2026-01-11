/**
 * Stats Database Tests
 *
 * Integration tests for stats reports using sql.js with snapshot testing.
 */

import type { StatsDatabase, StatsItemRecord, StatsReviewRecord } from '../types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStatsDatabase } from '../database'

// =============================================================================
// Test Data Generation
// =============================================================================

/**
 * Generate a date string N days from now (negative = past)
 */
function daysFromNow(days: number): Date {
	const date = new Date()
	date.setDate(date.getDate() + days)
	date.setHours(12, 0, 0, 0) // Noon to avoid timezone issues
	return date
}

/**
 * Format date as ISO string for reviews
 */
function formatTs(date: Date): string {
	return date.toISOString()
}

/**
 * Generate test reviews spanning the past 30 days with varied states
 */
function generateTestReviews(): StatsReviewRecord[] {
	const reviews: StatsReviewRecord[] = []
	let id = 1

	// Today: 8 reviews (varied)
	reviews.push(
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 3000,
			state_before: 'review',
			stability_before: 25,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4500,
			state_before: 'review',
			stability_before: 15,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 6000,
			state_before: 'review',
			stability_before: 30,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 8000,
			state_before: 'review',
			stability_before: 10,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3500,
			state_before: 'relearning',
			stability_before: 5,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2000,
			state_before: 'review',
			stability_before: 45,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(0)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 5000,
			state_before: 'review',
			stability_before: 8,
			difficulty_before: 5,
		},
	)

	// Yesterday: 12 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2800,
			state_before: 'review',
			stability_before: 22,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4200,
			state_before: 'review',
			stability_before: 18,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 3100,
			state_before: 'review',
			stability_before: 35,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 7000,
			state_before: 'review',
			stability_before: 12,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2200,
			state_before: 'learning',
			stability_before: 2,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4800,
			state_before: 'review',
			stability_before: 28,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 9500,
			state_before: 'review',
			stability_before: 8,
			difficulty_before: 8,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2600,
			state_before: 'review',
			stability_before: 50,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3900,
			state_before: 'relearning',
			stability_before: 4,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2100,
			state_before: 'review',
			stability_before: 40,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 5200,
			state_before: 'review',
			stability_before: 16,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-1)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2400,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
	)

	// 2 days ago: 10 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 3000,
			state_before: 'review',
			stability_before: 20,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4000,
			state_before: 'review',
			stability_before: 14,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2700,
			state_before: 'review',
			stability_before: 32,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2300,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 6500,
			state_before: 'review',
			stability_before: 25,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4100,
			state_before: 'review',
			stability_before: 19,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'review',
			stability_before: 42,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 8500,
			state_before: 'relearning',
			stability_before: 3,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2900,
			state_before: 'review',
			stability_before: 38,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-2)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3800,
			state_before: 'review',
			stability_before: 11,
			difficulty_before: 6,
		},
	)

	// 3 days ago: 6 reviews (lighter day)
	reviews.push(
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2600,
			state_before: 'review',
			stability_before: 28,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4300,
			state_before: 'review',
			stability_before: 17,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2200,
			state_before: 'learning',
			stability_before: 2,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2800,
			state_before: 'review',
			stability_before: 55,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 7200,
			state_before: 'review',
			stability_before: 9,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-3)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3600,
			state_before: 'review',
			stability_before: 23,
			difficulty_before: 5,
		},
	)

	// 5 days ago: 9 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2400,
			state_before: 'review',
			stability_before: 30,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4500,
			state_before: 'review',
			stability_before: 13,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2100,
			state_before: 'review',
			stability_before: 48,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 9000,
			state_before: 'review',
			stability_before: 7,
			difficulty_before: 8,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2700,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3900,
			state_before: 'relearning',
			stability_before: 6,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'review',
			stability_before: 35,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4200,
			state_before: 'review',
			stability_before: 21,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-5)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2300,
			state_before: 'review',
			stability_before: 26,
			difficulty_before: 4,
		},
	)

	// 7 days ago: 11 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2600,
			state_before: 'review',
			stability_before: 33,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4100,
			state_before: 'review',
			stability_before: 16,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 6800,
			state_before: 'review',
			stability_before: 22,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2200,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2800,
			state_before: 'review',
			stability_before: 44,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3700,
			state_before: 'review',
			stability_before: 19,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 8800,
			state_before: 'relearning',
			stability_before: 4,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2400,
			state_before: 'review',
			stability_before: 52,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4400,
			state_before: 'review',
			stability_before: 12,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2100,
			state_before: 'review',
			stability_before: 29,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-7)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3500,
			state_before: 'review',
			stability_before: 24,
			difficulty_before: 5,
		},
	)

	// 10 days ago: 7 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'review',
			stability_before: 36,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4000,
			state_before: 'review',
			stability_before: 15,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2300,
			state_before: 'learning',
			stability_before: 2,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 7500,
			state_before: 'review',
			stability_before: 10,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2700,
			state_before: 'review',
			stability_before: 41,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3800,
			state_before: 'review',
			stability_before: 20,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-10)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2600,
			state_before: 'review',
			stability_before: 27,
			difficulty_before: 4,
		},
	)

	// 14 days ago: 8 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2400,
			state_before: 'review',
			stability_before: 31,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4200,
			state_before: 'review',
			stability_before: 14,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2200,
			state_before: 'review',
			stability_before: 46,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 9200,
			state_before: 'review',
			stability_before: 6,
			difficulty_before: 8,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2800,
			state_before: 'learning',
			stability_before: 1,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3600,
			state_before: 'relearning',
			stability_before: 5,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'review',
			stability_before: 38,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-14)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4100,
			state_before: 'review',
			stability_before: 18,
			difficulty_before: 5,
		},
	)

	// 21 days ago: 5 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-21)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2600,
			state_before: 'review',
			stability_before: 34,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-21)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4300,
			state_before: 'review',
			stability_before: 17,
			difficulty_before: 5,
		},
		{
			ts: formatTs(daysFromNow(-21)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2100,
			state_before: 'review',
			stability_before: 50,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-21)),
			item_id: `item_${id++}`,
			rating: 2,
			elapsed_ms: 7000,
			state_before: 'review',
			stability_before: 11,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-21)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2400,
			state_before: 'learning',
			stability_before: 2,
			difficulty_before: 5,
		},
	)

	// 28 days ago: 6 reviews
	reviews.push(
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2500,
			state_before: 'review',
			stability_before: 29,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 4000,
			state_before: 'review',
			stability_before: 13,
			difficulty_before: 6,
		},
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2700,
			state_before: 'review',
			stability_before: 43,
			difficulty_before: 3,
		},
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 3,
			elapsed_ms: 3900,
			state_before: 'relearning',
			stability_before: 4,
			difficulty_before: 7,
		},
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 4,
			elapsed_ms: 2300,
			state_before: 'review',
			stability_before: 37,
			difficulty_before: 4,
		},
		{
			ts: formatTs(daysFromNow(-28)),
			item_id: `item_${id++}`,
			rating: 1,
			elapsed_ms: 8500,
			state_before: 'review',
			stability_before: 8,
			difficulty_before: 8,
		},
	)

	return reviews
}

/**
 * Generate test items with varied due dates and states
 */
function generateTestItems(): StatsItemRecord[] {
	const items: StatsItemRecord[] = []

	// Overdue items (backlog)
	items.push(
		{
			id: 'overdue_1',
			status: 'review',
			due: daysFromNow(-3),
			stability: 15,
			difficulty: 5,
			reps: 8,
			lapses: 1,
		},
		{
			id: 'overdue_2',
			status: 'review',
			due: daysFromNow(-2),
			stability: 25,
			difficulty: 4,
			reps: 12,
			lapses: 0,
		},
		{
			id: 'overdue_3',
			status: 'relearning',
			due: daysFromNow(-1),
			stability: 3,
			difficulty: 7,
			reps: 5,
			lapses: 2,
		},
	)

	// Due today
	items.push(
		{
			id: 'today_1',
			status: 'review',
			due: daysFromNow(0),
			stability: 20,
			difficulty: 5,
			reps: 10,
			lapses: 1,
		},
		{
			id: 'today_2',
			status: 'review',
			due: daysFromNow(0),
			stability: 35,
			difficulty: 4,
			reps: 15,
			lapses: 0,
		},
		{
			id: 'today_3',
			status: 'learning',
			due: daysFromNow(0),
			stability: 1,
			difficulty: 5,
			reps: 2,
			lapses: 0,
		},
		{
			id: 'today_4',
			status: 'review',
			due: daysFromNow(0),
			stability: 12,
			difficulty: 6,
			reps: 6,
			lapses: 2,
		},
	)

	// Due tomorrow
	items.push(
		{
			id: 'tomorrow_1',
			status: 'review',
			due: daysFromNow(1),
			stability: 22,
			difficulty: 5,
			reps: 11,
			lapses: 0,
		},
		{
			id: 'tomorrow_2',
			status: 'review',
			due: daysFromNow(1),
			stability: 18,
			difficulty: 5,
			reps: 9,
			lapses: 1,
		},
		{
			id: 'tomorrow_3',
			status: 'review',
			due: daysFromNow(1),
			stability: 30,
			difficulty: 4,
			reps: 14,
			lapses: 0,
		},
	)

	// Due in 2 days
	items.push(
		{
			id: 'day2_1',
			status: 'review',
			due: daysFromNow(2),
			stability: 28,
			difficulty: 4,
			reps: 13,
			lapses: 0,
		},
		{
			id: 'day2_2',
			status: 'review',
			due: daysFromNow(2),
			stability: 16,
			difficulty: 6,
			reps: 7,
			lapses: 1,
		},
	)

	// Due in 3 days
	items.push(
		{
			id: 'day3_1',
			status: 'review',
			due: daysFromNow(3),
			stability: 32,
			difficulty: 4,
			reps: 16,
			lapses: 0,
		},
		{
			id: 'day3_2',
			status: 'review',
			due: daysFromNow(3),
			stability: 24,
			difficulty: 5,
			reps: 12,
			lapses: 1,
		},
		{
			id: 'day3_3',
			status: 'review',
			due: daysFromNow(3),
			stability: 40,
			difficulty: 3,
			reps: 20,
			lapses: 0,
		},
	)

	// Due in 5 days
	items.push(
		{
			id: 'day5_1',
			status: 'review',
			due: daysFromNow(5),
			stability: 45,
			difficulty: 3,
			reps: 22,
			lapses: 0,
		},
		{
			id: 'day5_2',
			status: 'review',
			due: daysFromNow(5),
			stability: 19,
			difficulty: 5,
			reps: 10,
			lapses: 1,
		},
	)

	// Due in 7 days
	items.push(
		{
			id: 'day7_1',
			status: 'review',
			due: daysFromNow(7),
			stability: 50,
			difficulty: 3,
			reps: 25,
			lapses: 0,
		},
		{
			id: 'day7_2',
			status: 'review',
			due: daysFromNow(7),
			stability: 26,
			difficulty: 5,
			reps: 13,
			lapses: 0,
		},
		{
			id: 'day7_3',
			status: 'review',
			due: daysFromNow(7),
			stability: 38,
			difficulty: 4,
			reps: 18,
			lapses: 1,
		},
	)

	// Due in 14 days
	items.push(
		{
			id: 'day14_1',
			status: 'review',
			due: daysFromNow(14),
			stability: 60,
			difficulty: 3,
			reps: 30,
			lapses: 0,
		},
		{
			id: 'day14_2',
			status: 'review',
			due: daysFromNow(14),
			stability: 42,
			difficulty: 4,
			reps: 21,
			lapses: 0,
		},
	)

	// Due in 21 days
	items.push({
		id: 'day21_1',
		status: 'review',
		due: daysFromNow(21),
		stability: 70,
		difficulty: 3,
		reps: 35,
		lapses: 0,
	})

	// Due in 30 days
	items.push(
		{
			id: 'day30_1',
			status: 'review',
			due: daysFromNow(30),
			stability: 90,
			difficulty: 2,
			reps: 45,
			lapses: 0,
		},
		{
			id: 'day30_2',
			status: 'review',
			due: daysFromNow(30),
			stability: 55,
			difficulty: 4,
			reps: 27,
			lapses: 1,
		},
	)

	// New items (no due date)
	items.push(
		{ id: 'new_1', status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0 },
		{ id: 'new_2', status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0 },
		{ id: 'new_3', status: 'new', due: null, stability: 0, difficulty: 0, reps: 0, lapses: 0 },
	)

	return items
}

// =============================================================================
// Tests
// =============================================================================

describe('stats Database', () => {
	let statsDb: StatsDatabase
	let testReviews: StatsReviewRecord[]
	let testItems: StatsItemRecord[]

	beforeAll(async () => {
		testReviews = generateTestReviews()
		testItems = generateTestItems()
		statsDb = await createStatsDatabase(testReviews, testItems)
	})

	afterAll(() => {
		statsDb.close()
	})

	describe('database Creation', () => {
		it('creates database from review and item records', () => {
			expect(statsDb).toBeDefined()
			expect(statsDb.getFutureDueReport).toBeInstanceOf(Function)
			expect(statsDb.getReviewsHistoryReport).toBeInstanceOf(Function)
			expect(statsDb.getRetentionReport).toBeInstanceOf(Function)
		})

		it('stores correct number of reviews', () => {
			// Verify via reviews history which counts reviews
			const report = statsDb.getReviewsHistoryReport(30)
			expect(report.summary.totalReviews).toBe(testReviews.length)
		})
	})

	describe('future Due Report', () => {
		it('returns valid report structure for 7 days', () => {
			const report = statsDb.getFutureDueReport(7)

			expect(report.data).toBeDefined()
			expect(report.summary).toBeDefined()
			expect(report.data.length).toBeGreaterThan(0)
		})

		it('returns valid report structure for 30 days', () => {
			const report = statsDb.getFutureDueReport(30)

			expect(report.data).toBeDefined()
			expect(report.summary).toBeDefined()
			expect(report.data.length).toBeGreaterThan(0)
		})

		it('distributes backlog across negative days (Anki-style)', () => {
			const report = statsDb.getFutureDueReport(7)
			const day0 = report.data.find((d) => d.daysFromNow === 0)

			// Day 0 should only contain today's items (4), not backlog
			expect(day0?.count).toBe(4)
			expect(day0?.todayOnly).toBe(4)

			// Backlog items should appear on negative days
			const negativeDays = report.data.filter((d) => d.daysFromNow < 0)
			expect(negativeDays.length).toBeGreaterThan(0)

			// Total backlog in negative days should equal backlog metadata
			const totalBacklog = negativeDays.reduce((sum, d) => sum + d.count, 0)
			expect(day0?.backlog).toBe(totalBacklog)

			// We have overdue items in test data, so backlog should be > 0
			expect(totalBacklog).toBeGreaterThan(0)
		})

		it('calculates cumulative correctly', () => {
			const report = statsDb.getFutureDueReport(7)

			// Verify cumulative is monotonically increasing
			let prevCumulative = 0
			for (const day of report.data) {
				expect(day.cumulative).toBeGreaterThanOrEqual(prevCumulative)
				prevCumulative = day.cumulative
			}
		})

		it('calculates summary statistics', () => {
			const report = statsDb.getFutureDueReport(7)

			expect(report.summary.total).toBeGreaterThan(0)
			expect(report.summary.dueTomorrow).toBeGreaterThan(0) // Items due tomorrow
			expect(report.summary.dailyLoad).toBeGreaterThan(0)
		})
	})

	describe('reviews History Report', () => {
		it('returns report for 7 days', () => {
			const report = statsDb.getReviewsHistoryReport(7)

			expect(report).toMatchSnapshot()
		})

		it('returns report for 30 days', () => {
			const report = statsDb.getReviewsHistoryReport(30)

			expect(report).toMatchSnapshot()
		})

		it('breaks down reviews by state', () => {
			const report = statsDb.getReviewsHistoryReport(7)

			// Find today's data (daysAgo = 0)
			const today = report.data.find((d) => d.daysAgo === 0)
			expect(today).toBeDefined()

			// Today has mixed states in test data
			expect(today!.learning).toBeGreaterThan(0)
			expect(today!.young).toBeGreaterThan(0)
			expect(today!.mature).toBeGreaterThan(0)
			expect(today!.relearning).toBeGreaterThan(0)
			expect(today!.total).toBe(
				today!.learning + today!.young + today!.mature + today!.relearning,
			)
		})

		it('calculates cumulative correctly', () => {
			const report = statsDb.getReviewsHistoryReport(7)

			// Verify cumulative increases (data is ordered from oldest to newest)
			let prevCumulative = 0
			for (const day of report.data) {
				expect(day.cumulative).toBeGreaterThanOrEqual(prevCumulative)
				prevCumulative = day.cumulative
			}
		})

		it('calculates summary statistics', () => {
			const report = statsDb.getReviewsHistoryReport(7)

			expect(report.summary.daysStudied).toBeGreaterThan(0)
			expect(report.summary.totalDays).toBe(7)
			expect(report.summary.totalReviews).toBeGreaterThan(0)
			expect(report.summary.avgPerPeriod).toBeGreaterThan(0)
			expect(report.summary.avgPerStudyDay).toBeGreaterThanOrEqual(
				report.summary.avgPerPeriod,
			)
		})
	})

	describe('retention Report', () => {
		it('returns report with target retention 0.9', () => {
			const report = statsDb.getRetentionReport(0.9)

			expect(report).toMatchSnapshot()
		})

		it('returns report with target retention 0.85', () => {
			const report = statsDb.getRetentionReport(0.85)

			expect(report).toMatchSnapshot()
		})

		it('has all time periods', () => {
			const report = statsDb.getRetentionReport(0.9)

			const periods = report.data.map((d) => d.period)
			expect(periods).toContain('Today')
			expect(periods).toContain('Yesterday')
			expect(periods).toContain('Last week')
			expect(periods).toContain('Last month')
			expect(periods).toContain('Last year')
		})

		it('calculates retention percentages', () => {
			const report = statsDb.getRetentionReport(0.9)

			// Last week should have data
			const lastWeek = report.data.find((d) => d.period === 'Last week')
			expect(lastWeek).toBeDefined()
			expect(lastWeek!.count).toBeGreaterThan(0)

			// Retention should be between 0-100 or null
			if (lastWeek!.totalRetention !== null) {
				expect(lastWeek!.totalRetention).toBeGreaterThanOrEqual(0)
				expect(lastWeek!.totalRetention).toBeLessThanOrEqual(100)
			}
		})

		it('separates young and mature cards', () => {
			const report = statsDb.getRetentionReport(0.9)

			// Last month should have both young and mature reviews
			const lastMonth = report.data.find((d) => d.period === 'Last month')
			expect(lastMonth).toBeDefined()

			// Our test data has reviews with stability_before < 21 (young) and >= 21 (mature)
			// Both should have retention values
			expect(lastMonth!.youngRetention).not.toBeNull()
			expect(lastMonth!.matureRetention).not.toBeNull()
		})

		it('preserves target retention in report', () => {
			const report = statsDb.getRetentionReport(0.9)
			expect(report.targetRetention).toBe(0.9)
		})
	})

	describe('edge Cases', () => {
		it('handles empty database', async () => {
			const emptyDb = await createStatsDatabase([], [])

			const futureDue = emptyDb.getFutureDueReport(7)
			expect(futureDue.summary.total).toBe(0)

			const history = emptyDb.getReviewsHistoryReport(7)
			expect(history.summary.totalReviews).toBe(0)

			const retention = emptyDb.getRetentionReport(0.9)
			expect(retention.data.every((d) => d.count === 0)).toBe(true)

			emptyDb.close()
		})

		it('handles items without due dates', async () => {
			const items: StatsItemRecord[] = [
				{
					id: 'new_only',
					status: 'new',
					due: null,
					stability: 0,
					difficulty: 0,
					reps: 0,
					lapses: 0,
				},
			]
			const db = await createStatsDatabase([], items)

			const report = db.getFutureDueReport(7)
			expect(report.summary.total).toBe(0) // New items have no due date

			db.close()
		})

		it('handles reviews without state_before', async () => {
			const reviews: StatsReviewRecord[] = [
				{ ts: formatTs(daysFromNow(0)), item_id: 'item_1', rating: 4 },
				{ ts: formatTs(daysFromNow(0)), item_id: 'item_2', rating: 3 },
			]
			const db = await createStatsDatabase(reviews, [])

			const report = db.getReviewsHistoryReport(7)
			expect(report.summary.totalReviews).toBe(2)

			db.close()
		})
	})
})
