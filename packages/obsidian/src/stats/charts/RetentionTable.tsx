import type { RetentionReport, StatsDatabase } from '@repo/core/stats'
import type { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'

export interface RetentionTableProps {
	statsDb: StatsDatabase
	targetRetention: number
}

type FilterMode = 'young' | 'mature' | 'all'

export const RetentionTable: FunctionalComponent<RetentionTableProps> = ({
	statsDb,
	targetRetention,
}) => {
	const [filter, setFilter] = useState<FilterMode>('all')

	const report: RetentionReport = useMemo(
		() => statsDb.getRetentionReport(targetRetention),
		[statsDb, targetRetention],
	)

	const formatRetention = (value: number | null): string => {
		if (value === null) return 'N/A'
		return `${value.toFixed(1)}%`
	}

	const getRetentionClass = (value: number | null): string => {
		if (value === null) return 'ir-stats-retention-na'
		const target = report.targetRetention * 100
		if (value >= target) return 'ir-stats-retention-good'
		if (value >= target - 5) return 'ir-stats-retention-ok'
		return 'ir-stats-retention-low'
	}

	return (
		<div className="ir-stats-chart ir-stats-retention">
			<h3>Retention</h3>
			<p className="ir-stats-chart-desc">Pass rate of cards with an interval {'>='} 1 day.</p>

			<div className="ir-stats-chart-controls">
				<label>
					<input
						type="radio"
						name="retention-filter"
						checked={filter === 'young'}
						onChange={() => setFilter('young')}
					/>
					Young
				</label>
				<label>
					<input
						type="radio"
						name="retention-filter"
						checked={filter === 'mature'}
						onChange={() => setFilter('mature')}
					/>
					Mature
				</label>
				<label>
					<input
						type="radio"
						name="retention-filter"
						checked={filter === 'all'}
						onChange={() => setFilter('all')}
					/>
					All
				</label>
			</div>

			<table className="ir-stats-table">
				<thead>
					<tr>
						<th />
						<th className="ir-stats-retention-col-young">Young</th>
						<th className="ir-stats-retention-col-mature">Mature</th>
						<th className="ir-stats-retention-col-total">Total</th>
						<th className="ir-stats-retention-col-count">Count</th>
					</tr>
				</thead>
				<tbody>
					{report.data.map((row) => (
						<tr key={row.period}>
							<td className="ir-stats-retention-period">{row.period}</td>
							<td
								className={`ir-stats-retention-value ${getRetentionClass(row.youngRetention)}`}
							>
								{formatRetention(row.youngRetention)}
							</td>
							<td
								className={`ir-stats-retention-value ${getRetentionClass(row.matureRetention)}`}
							>
								{formatRetention(row.matureRetention)}
							</td>
							<td
								className={`ir-stats-retention-value ${getRetentionClass(row.totalRetention)}`}
							>
								{formatRetention(row.totalRetention)}
							</td>
							<td className="ir-stats-retention-count">
								{row.count.toLocaleString()}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<p className="ir-stats-target-info">
				Target retention: {(report.targetRetention * 100).toFixed(0)}%
			</p>
		</div>
	)
}
