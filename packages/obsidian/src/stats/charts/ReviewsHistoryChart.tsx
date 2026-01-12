import type { ReviewsHistoryData, ReviewsHistoryReport, StatsDatabase } from '@repo/core/stats'
import type { FunctionalComponent } from 'preact'
import { max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { useCallback, useMemo, useRef, useState } from 'preact/hooks'

interface ReviewsHistoryChartProps {
	statsDb: StatsDatabase
	days: number
}

interface TooltipState {
	visible: boolean
	x: number
	y: number
	data: ReviewsHistoryData | null
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 200
const MARGIN = { top: 20, right: 50, bottom: 30, left: 40 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

// Colors for stacked bars (matching Anki's scheme)
const COLORS = {
	learning: '#77c', // blue/purple - learning
	young: '#7c7', // green - young (review, stability < 21)
	mature: '#070', // dark green - mature (review, stability >= 21)
	relearning: '#c77', // orange/red - relearning
}

export const ReviewsHistoryChart: FunctionalComponent<ReviewsHistoryChartProps> = ({
	statsDb,
	days,
}) => {
	const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, data: null })
	const svgRef = useRef<SVGSVGElement>(null)
	const report: ReviewsHistoryReport = useMemo(
		() => statsDb.getReviewsHistoryReport(days),
		[statsDb, days],
	)

	const maxTotal = max(report.data, (d) => d.total) ?? 0
	const maxCumulative = max(report.data, (d) => d.cumulative) ?? 0

	const xScale = scaleLinear().domain([-days, 0]).range([0, INNER_WIDTH])

	const yScaleLeft = scaleLinear()
		.domain([0, Math.max(maxTotal, 1)])
		.range([INNER_HEIGHT, 0])
		.nice()

	const yScaleRight = scaleLinear()
		.domain([0, Math.max(maxCumulative, 1)])
		.range([INNER_HEIGHT, 0])
		.nice()

	const barWidth = Math.max(1, (INNER_WIDTH / (days + 1)) * 0.8)

	// Generate tick values for x-axis
	const xTicks = useMemo(() => {
		const step = days <= 30 ? 5 : days <= 90 ? 10 : 30
		const ticks: number[] = []
		for (let i = -days; i <= 0; i += step) {
			ticks.push(i)
		}
		if (!ticks.includes(0)) ticks.push(0)
		return ticks
	}, [days])

	// Generate tick values for y-axes
	const yTicksLeft = yScaleLeft.ticks(5)
	const yTicksRight = yScaleRight.ticks(5)

	// Calculate stacked bar positions
	/* eslint-disable ts/prefer-readonly-parameter-types -- Data type */
	const getStackedBars = (
		d: ReviewsHistoryData,
	): Array<{ key: string; y: number; height: number; color: string }> => {
		/* eslint-enable ts/prefer-readonly-parameter-types */
		const bars: Array<{ key: string; y: number; height: number; color: string }> = []
		let currentY = INNER_HEIGHT

		// Stack order: mature (bottom), young, relearning, learning (top)
		const segments = [
			{ key: 'mature', value: d.mature, color: COLORS.mature },
			{ key: 'young', value: d.young, color: COLORS.young },
			{ key: 'relearning', value: d.relearning, color: COLORS.relearning },
			{ key: 'learning', value: d.learning, color: COLORS.learning },
		]

		for (const seg of segments) {
			if (seg.value > 0) {
				const height = INNER_HEIGHT - yScaleLeft(seg.value)
				currentY -= height
				bars.push({
					key: seg.key,
					y: currentY,
					height,
					color: seg.color,
				})
			}
		}

		return bars
	}

	const studyPercentage =
		report.summary.totalDays > 0
			? ((report.summary.daysStudied / report.summary.totalDays) * 100).toFixed(2)
			: '0'

	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DOM/data types
	const handleBarHover = useCallback((e: MouseEvent, d: ReviewsHistoryData) => {
		if (svgRef.current === null) return
		const svgRect = svgRef.current.getBoundingClientRect()
		const x = e.clientX - svgRect.left
		const y = e.clientY - svgRect.top
		setTooltip({ visible: true, x, y, data: d })
	}, [])

	const handleBarLeave = useCallback(() => {
		setTooltip({ visible: false, x: 0, y: 0, data: null })
	}, [])

	const formatDayLabel = (daysAgo: number): string => {
		if (daysAgo === 0) return 'Today'
		if (daysAgo === -1) return 'Yesterday'
		return `${Math.abs(daysAgo)} days ago`
	}

	return (
		<div className="ir-stats-chart ir-stats-reviews-history">
			<h3>Reviews</h3>
			<p className="ir-stats-chart-desc">The number of questions you have answered.</p>

			<div className="ir-stats-legend">
				<span className="ir-stats-legend-item">
					<span
						className="ir-stats-legend-color"
						style={{ backgroundColor: COLORS.learning }}
					/>
					Learning
				</span>
				<span className="ir-stats-legend-item">
					<span
						className="ir-stats-legend-color"
						style={{ backgroundColor: COLORS.young }}
					/>
					Young
				</span>
				<span className="ir-stats-legend-item">
					<span
						className="ir-stats-legend-color"
						style={{ backgroundColor: COLORS.mature }}
					/>
					Mature
				</span>
				<span className="ir-stats-legend-item">
					<span
						className="ir-stats-legend-color"
						style={{ backgroundColor: COLORS.relearning }}
					/>
					Relearning
				</span>
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
							{formatDayLabel(tooltip.data.daysAgo)}
						</div>
						<div className="ir-stats-tooltip-row">
							<span style={{ color: COLORS.learning }}>Learning:</span>
							<strong>{tooltip.data.learning}</strong>
						</div>
						<div className="ir-stats-tooltip-row">
							<span style={{ color: COLORS.young }}>Young:</span>
							<strong>{tooltip.data.young}</strong>
						</div>
						<div className="ir-stats-tooltip-row">
							<span style={{ color: COLORS.mature }}>Mature:</span>
							<strong>{tooltip.data.mature}</strong>
						</div>
						<div className="ir-stats-tooltip-row">
							<span style={{ color: COLORS.relearning }}>Relearning:</span>
							<strong>{tooltip.data.relearning}</strong>
						</div>
						<div className="ir-stats-tooltip-row ir-stats-tooltip-total">
							<span>Total:</span>
							<strong>{tooltip.data.total}</strong>
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

						{/* Stacked bars */}
						{report.data.map((d) => {
							const bars = getStackedBars(d)
							const isHovered = tooltip.data?.daysAgo === d.daysAgo
							return (
								<g
									key={d.daysAgo}
									transform={`translate(${xScale(d.daysAgo) - barWidth / 2}, 0)`}
									style={{ cursor: 'pointer' }}
									onMouseMove={(e) =>
										handleBarHover(e as unknown as MouseEvent, d)
									}
									onMouseLeave={handleBarLeave}
								>
									{bars.map((bar, i) => (
										<rect
											key={bar.key}
											x={0}
											y={bar.y}
											width={barWidth}
											height={bar.height}
											fill={bar.color}
											opacity={isHovered ? 1 : 0.9}
											rx={i === bars.length - 1 ? 1 : 0}
										/>
									))}
									{/* Invisible hover area for easier interaction */}
									<rect
										x={0}
										y={0}
										width={barWidth}
										height={INNER_HEIGHT}
										fill="transparent"
									/>
								</g>
							)
						})}

						{/* Cumulative line - subtle */}
						<path
							d={report.data
								.map(
									(d, i) =>
										`${i === 0 ? 'M' : 'L'} ${xScale(d.daysAgo)} ${yScaleRight(d.cumulative)}`,
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
					<span className="ir-stats-summary-label">Days studied:</span>
					<span className="ir-stats-summary-value">
						{report.summary.daysStudied} of {report.summary.totalDays} (
						{studyPercentage}%)
					</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Total:</span>
					<span className="ir-stats-summary-value">
						{report.summary.totalReviews.toLocaleString()} reviews
					</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Average over period:</span>
					<span className="ir-stats-summary-value">
						{report.summary.avgPerPeriod} reviews/day
					</span>
				</div>
				<div className="ir-stats-summary-item">
					<span className="ir-stats-summary-label">Average for days studied:</span>
					<span className="ir-stats-summary-value">
						{report.summary.avgPerStudyDay} reviews/day
					</span>
				</div>
			</div>
		</div>
	)
}
