import type { DeckInfo, StreakInfo, TodayStats } from '@repo/core/core/types'
import type { FunctionalComponent } from 'preact'
import type { DeckCountsValue } from './deck-summary-types'
import { DeckSummary } from './DeckSummary'

export interface ReviewFolderScreenProps {
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

export const ReviewFolderScreen: FunctionalComponent<ReviewFolderScreenProps> = ({
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
	return (
		<DeckSummary
			decks={decks}
			selectedPath={selectedPath}
			allCounts={allCounts}
			todayStats={todayStats}
			streak={streak}
			showStreak={showStreak}
			onSelect={onSelect}
			onStudy={onStudy}
			onStats={onStats}
		/>
	)
}
