import type { FutureDueData, FutureDueReport, StatsDatabase } from '@repo/core/stats'
import type { FunctionalComponent } from 'preact'
import { max, min } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { useCallback, useMemo, useRef, useState } from 'preact/hooks'

export interface FutureDueChartProps {
	statsDb: StatsDatabase
	days: number
}

interface TooltipState {
	visible: boolean
	x: number
	y: number
	data: FutureDueData | null
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 200
const MARGIN = { top: 20, right: 50, bottom: 30, left: 40 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

export const FutureDueChart: FunctionalComponent<FutureDueChartProps> = ({ statsDb, days }) => {
	const [showBacklog, setShowBacklog] = useState(true)
	const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, data: null })
	const svgRef = useRef<SVGSVGElement>(null)

	const report: FutureDueReport = useMemo(() => statsDb.getFutureDueReport(days), [statsDb, days])

	// Filter data based on backlog toggle
	const chartData = useMemo(() => {
		if (showBacklog) return report.data
		// When backlog is hidden, filter out negative days and adjust cumulative
		const day0 = report.data.find((d) => d.daysFromNow === 0)
		const backlogTotal = day0?.backlog ?? 0

		return report.data
			.filter((d) => d.daysFromNow >= 0)
			.map((d) => ({
				...d,
				cumulative: d.cumulative - backlogTotal,
			}))
	}, [report.data, showBacklog])

	// Calculate x-axis range
	const minDay = min(chartData, (d) => d.daysFromNow) ?? 0
	const maxDay = max(chartData, (d) => d.daysFromNow) ?? days

	const maxCount = max(chartData, (d) => d.count) ?? 0
	const maxCumulative = max(chartData, (d) => d.cumulative) ?? 0

	const xScale = scaleLinear().domain([minDay, maxDay]).range([0, INNER_WIDTH])

	const yScaleLeft = scaleLinear()
		.domain([0, Math.max(maxCount, 1)])
		.range([INNER_HEIGHT, 0])
		.nice()

	const yScaleRight = scaleLinear()
		.domain([0, Math.max(maxCumulative, 1)])
		.range([INNER_HEIGHT, 0])
		.nice()

	// Calculate bar width based on total days shown
	const totalDays = maxDay - minDay + 1
	const barWidth = Math.max(1, (INNER_WIDTH / totalDays) * 0.8)

	// Generate tick values for x-axis (include negative values when showing backlog)
	const xTicks = useMemo(() => {
		const range = maxDay - minDay
		const step = range <= 30 ? 5 : range <= 60 ? 10 : range <= 180 ? 30 : 60
		const ticks: number[] = []

		// Start from a rounded negative value
		const start = Math.ceil(minDay / step) * step
		for (let i = start; i <= maxDay; i += step) {
			ticks.push(i)
		}

		// Always include 0 if in range
		if (minDay <= 0 && maxDay >= 0 && !ticks.includes(0)) {
			ticks.push(0)
			ticks.sort((a, b) => a - b)
		}

		return ticks
	}, [minDay, maxDay])

	// Generate tick values for y-axes
	const yTicksLeft = yScaleLeft.ticks(5)
	const yTicksRight = yScaleRight.ticks(5)

	const handleBarHover = useCallback((e: MouseEvent, d: FutureDueData) => {
		if (!svgRef.current) return
		const svgRect = svgRef.current.getBoundingClientRect()
		const x = e.clientX - svgRect.left
		const y = e.clientY - svgRect.top
		setTooltip({ visible: true, x, y, data: d })
	}, [])

	const handleBarLeave = useCallback(() => {
		setTooltip({ visible: false, x: 0, y: 0, data: null })
	}, [])

	const formatDayLabel = (daysFromNow: number): string => {
		if (daysFromNow === 0) return 'Today'
		if (daysFromNow === 1) return 'Tomorrow'
		if (daysFromNow === -1) return 'Yesterday'
		if (daysFromNow < 0) return `${Math.abs(daysFromNow)} days ago`
		return `In ${daysFromNow} days`
	}

	// Different bar color for backlog (past due) vs future
	const getBarFill = (daysFromNow: number): string => {
		if (daysFromNow < 0) return 'var(--color-red)'
		if (daysFromNow === 0) return 'var(--color-orange)'
		return 'var(--interactive-accent)'
	}

	return (
		<div className="ir-stats-chart ir-stats-future-due">
			<h3>Future Due</h3>
			<p className="ir-stats-chart-desc">The number of reviews due in the future.</p>

			<div className="ir-stats-chart-controls">
				<label>
					<input
						type="checkbox"
						checked={showBacklog}
						onChange={(e) => setShowBacklog((e.target as HTMLInputElement).checked)}
					/>
					Backlog
				</label>
			</div>

			<div className="ir-stats-chart-container">
				{tooltip.visible && tooltip.data && (
					<div
						className="ir-stats-tooltip"
						style={{
							left: `${tooltip.x}px`,
							top: `${tooltip.y - 10}px`,
						}}
					>
						<div className="ir-stats-tooltip-title">
							{formatDayLabel(tooltip.data.daysFromNow)}
						</div>
						<div className="ir-stats-tooltip-row">
							<span>Due:</span>
							<strong>{tooltip.data.count}</strong>
						</div>
						<div className="ir-stats-tooltip-row">
							<span>Cumulative:</span>
							<strong>{tooltip.data.cumulative}</strong>
						</div>
					</div>
				)}
				<svg
					ref={svgRef}
					viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
					className="ir-stats-svg"
					preserveAspectRatio="xMidYMid meet"
				>
					<g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
						{/* Subtle horizontal gridlines - Tufte style */}
						{yTicksLeft.slice(1).map((tick) => (
							<line
								key={tick}
								x1={0}
								y1={yScaleLeft(tick)}
								x2={INNER_WIDTH}
								y2={yScaleLeft(tick)}
								stroke="var(--background-modifier-border)"
								strokeDasharray="2,4"
								opacity={0.5}
							/>
						))}

						{/* Vertical line at day 0 (today) when showing backlog */}
						{showBacklog && minDay < 0 && (
							<line
								x1={xScale(0)}
								y1={0}
								x2={xScale(0)}
								y2={INNER_HEIGHT}
								stroke="var(--background-modifier-border)"
								strokeDasharray="4,4"
								opacity={0.7}
							/>
						)}

						{/* Y-axis left labels only (no axis line) */}
						<g className="ir-stats-axis ir-stats-axis-y-left">
							{yTicksLeft.map((tick) => (
								<text
									key={tick}
									x={-8}
									y={yScaleLeft(tick)}
									dy="0.32em"
									textAnchor="end"
									fontSize="10"
									fill="var(--text-faint)"
								>
									{tick}
								</text>
							))}
						</g>

						{/* Y-axis right labels only */}
						<g className="ir-stats-axis ir-stats-axis-y-right">
							{yTicksRight.map((tick) => (
								<text
									key={tick}
									x={INNER_WIDTH + 8}
									y={yScaleRight(tick)}
									dy="0.32em"
									textAnchor="start"
									fontSize="10"
									fill="var(--text-faint)"
								>
									{tick}
								</text>
							))}
						</g>

						{/* X-axis - minimal baseline */}
						<g
							className="ir-stats-axis ir-stats-axis-x"
							transform={`translate(0, ${INNER_HEIGHT})`}
						>
							<line
								x1={0}
								y1={0}
								x2={INNER_WIDTH}
								y2={0}
								stroke="var(--background-modifier-border)"
							/>
							{xTicks.map((tick) => (
								<text
									key={tick}
									x={xScale(tick)}
									y={16}
									textAnchor="middle"
									fontSize="10"
									fill="var(--text-faint)"
								>
									{tick}
								</text>
							))}
						</g>

						{/* Bars */}
						{chartData.map((d) => (
							<rect
								key={d.daysFromNow}
								x={xScale(d.daysFromNow) - barWidth / 2}
								y={yScaleLeft(d.count)}
								width={barWidth}
								height={INNER_HEIGHT - yScaleLeft(d.count)}
								fill={getBarFill(d.daysFromNow)}
								opacity={tooltip.data?.daysFromNow === d.daysFromNow ? 1 : 0.85}
								rx={1}
								style={{ cursor: 'pointer' }}
								onMouseMove={(e) => handleBarHover(e as unknown as MouseEvent, d)}
								onMouseLeave={handleBarLeave}
							/>
						))}

						{/* Cumulative line - subtle */}
						<path
							d={chartData
								.map(
									(d, i) =>
										`${i === 0 ? 'M' : 'L'} ${xScale(d.daysFromNow)} ${yScaleRight(d.cumulative)}`,
								)
								.join(' ')}
							fill="none"
							stroke="var(--text-faint)"
							strokeWidth={1.5}
						/>
					</g>
				</svg>
			</div>

			<div className="ir-stats-summary">
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Total:</span>
					<span className="ir-stats-summary-value">{report.summary.total} reviews</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Average:</span>
					<span className="ir-stats-summary-value">
						{report.summary.average} review/day
					</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Due tomorrow:</span>
					<span className="ir-stats-summary-value">
						{report.summary.dueTomorrow} reviews
					</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Daily load:</span>
					<span className="ir-stats-summary-value">
						{report.summary.dailyLoad} reviews/day
					</span>
				</div>
			</div>
		</div>
	)
}
