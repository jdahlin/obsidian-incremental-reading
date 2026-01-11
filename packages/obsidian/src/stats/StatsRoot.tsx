import type { StatsDatabase, StatsItemRecord, StatsReviewRecord } from '@repo/core/stats'
import type { App } from 'obsidian'
import type { FunctionalComponent } from 'preact'
import type { IncrementalReadingSettings } from '../settings'
import { MarkdownDataStore } from '@repo/core/data/MarkdownDataStore'
import { createStatsDatabase } from '@repo/core/stats'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { ObsidianNotePlatform, ObsidianVault } from '../adapters'
import { readAllReviews } from '../data/revlog'
import { FutureDueChart } from './charts/FutureDueChart'
import { RetentionTable } from './charts/RetentionTable'
import { ReviewsHistoryChart } from './charts/ReviewsHistoryChart'

export interface StatsRootProps {
	app: App
	settings: IncrementalReadingSettings
}

type TimePeriod = '1month' | '3months' | '1year' | 'all'

const PERIOD_DAYS: Record<TimePeriod, number> = {
	'1month': 30,
	'3months': 90,
	'1year': 365,
	all: 3650, // ~10 years
}

export const StatsRoot: FunctionalComponent<StatsRootProps> = ({ app, settings }) => {
	const [statsDb, setStatsDb] = useState<StatsDatabase | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [period, setPeriod] = useState<TimePeriod>('1month')

	const vault = useMemo(() => new ObsidianVault(app), [app])
	const notePlatform = useMemo(() => new ObsidianNotePlatform(app), [app])
	const dataStore = useMemo(
		() => new MarkdownDataStore(vault, notePlatform),
		[vault, notePlatform],
	)

	useEffect(() => {
		let cancelled = false

		async function loadStats(): Promise<void> {
			try {
				setLoading(true)
				setError(null)

				// Load reviews from revlog and convert to StatsReviewRecord
				const rawReviews = await readAllReviews(app)
				const reviews: StatsReviewRecord[] = rawReviews.map((r) => ({
					ts: r.ts,
					item_id: r.item_id,
					rating: r.rating,
					elapsed_ms: r.elapsed_ms,
					state_before: r.state_before,
					stability_before: r.stability_before,
					difficulty_before: r.difficulty_before,
				}))

				// Load items and convert to StatsItemRecord
				const engineItems = await dataStore.listItems()
				const items: StatsItemRecord[] = []

				for (const engineItem of engineItems) {
					const state = await dataStore.getState(engineItem.id)
					items.push({
						id: engineItem.id,
						status: state?.status ?? 'new',
						due: state?.due ?? null,
						stability: state?.stability ?? 0,
						difficulty: state?.difficulty ?? 0,
						reps: state?.reps ?? 0,
						lapses: state?.lapses ?? 0,
					})
				}

				if (cancelled) return

				// Create stats database using core
				const db = await createStatsDatabase(reviews, items)

				if (cancelled) {
					db.close()
					return
				}

				setStatsDb(db)
				setLoading(false)
			} catch (err) {
				if (!cancelled) {
					console.error('Stats loading error:', err)
					const message = err instanceof Error ? err.message : String(err)
					setError(message || 'Failed to load statistics')
					setLoading(false)
				}
			}
		}

		void loadStats()

		return () => {
			cancelled = true
		}
	}, [app, dataStore])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (statsDb) {
				statsDb.close()
			}
		}
	}, [statsDb])

	if (loading) {
		return (
			<div className="ir-stats-root ir-stats-loading">
				<div className="ir-stats-spinner" />
				<p>Loading statistics...</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="ir-stats-root ir-stats-error">
				<p>Error: {error}</p>
			</div>
		)
	}

	if (!statsDb) {
		return (
			<div className="ir-stats-root ir-stats-empty">
				<p>No data available</p>
			</div>
		)
	}

	const days = PERIOD_DAYS[period]

	return (
		<div className="ir-stats-root">
			<div className="ir-stats-period-selector">
				<label>
					<input
						type="radio"
						name="period"
						checked={period === '1month'}
						onChange={() => setPeriod('1month')}
					/>
					1 month
				</label>
				<label>
					<input
						type="radio"
						name="period"
						checked={period === '3months'}
						onChange={() => setPeriod('3months')}
					/>
					3 months
				</label>
				<label>
					<input
						type="radio"
						name="period"
						checked={period === '1year'}
						onChange={() => setPeriod('1year')}
					/>
					1 year
				</label>
				<label>
					<input
						type="radio"
						name="period"
						checked={period === 'all'}
						onChange={() => setPeriod('all')}
					/>
					all
				</label>
			</div>

			<div className="ir-stats-charts">
				<FutureDueChart statsDb={statsDb} days={days} />
				<ReviewsHistoryChart statsDb={statsDb} days={days} />
				<RetentionTable statsDb={statsDb} targetRetention={settings.requestRetention} />
			</div>
		</div>
	)
}
