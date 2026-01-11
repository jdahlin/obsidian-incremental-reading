import type { DeckInfo, StreakInfo, TodayStats } from '@repo/core/core/types'
import type { FunctionalComponent } from 'preact'
import type { DeckCountsValue } from './deck-summary-types'
import { flattenDecks } from './deck-summary-utils'
import { DeckList } from './DeckList'
import { DeckSummaryFooter } from './DeckSummaryFooter'
import { DeckSummaryHeader } from './DeckSummaryHeader'
import './DeckSummary.css'

export interface DeckSummaryProps {
	decks: DeckInfo[]
	selectedPath: string | null
	allCounts: DeckCountsValue
	todayStats: TodayStats
	streak: StreakInfo
	showStreak: boolean
	onSelect: (path: string | null) => void
	onStudy: () => void
	onStats: () => void
}

export const DeckSummary: FunctionalComponent<DeckSummaryProps> = ({
	decks,
	selectedPath,
	allCounts,
	todayStats,
	streak,
	showStreak,
	onSelect,
	onStudy,
	onStats,
}) => {
	const rows = flattenDecks(decks)

	return (
		<div className="ir-deck-summary">
			<DeckSummaryHeader onStats={onStats} onStudy={onStudy} />
			<DeckList
				rows={rows}
				selectedPath={selectedPath}
				allCounts={allCounts}
				onSelect={onSelect}
			/>
			<DeckSummaryFooter todayStats={todayStats} streak={streak} showStreak={showStreak} />
		</div>
	)
}
