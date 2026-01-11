import { describe, expect, it } from 'vitest'
import { addDays, addMinutes, daysBetween, isToday, startOfDay } from '../dates'

describe('date helpers', () => {
	it('adds days and minutes', () => {
		const base = new Date('2024-01-02T03:04:05')
		expect(addDays(base, 2).getTime()).toBe(new Date('2024-01-04T03:04:05').getTime())
		expect(addMinutes(base, 30).getTime()).toBe(new Date('2024-01-02T03:34:05').getTime())
	})

	it('normalizes to start of day', () => {
		const base = new Date('2024-01-02T03:04:05')
		const normalized = startOfDay(base)
		expect(normalized.getHours()).toBe(0)
		expect(normalized.getMinutes()).toBe(0)
	})

	it('checks whether a date is today', () => {
		const today = new Date('2024-01-02T10:00:00')
		const sameDay = new Date('2024-01-02T23:59:59')
		const otherDay = new Date('2024-01-03T00:00:00')
		expect(isToday(sameDay, today)).toBe(true)
		expect(isToday(otherDay, today)).toBe(false)
	})

	it('computes days between dates', () => {
		const a = new Date('2024-01-01T10:00:00')
		const b = new Date('2024-01-04T01:00:00')
		expect(daysBetween(a, b)).toBe(3)
	})
})
