import type { FunctionalComponent } from 'preact';
import type { DeckInfo, StreakInfo, TodayStats } from '../../core/types';
import { DeckSummary } from './DeckSummary';

export interface ReviewSummaryScreenProps {
	decks: DeckInfo[];
	selectedPath: string | null;
	allCounts: { new: number; learning: number; due: number };
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
	onSelect: (path: string | null) => void;
	onStudy: () => void;
	onStats: () => void;
}

export const ReviewSummaryScreen: FunctionalComponent<ReviewSummaryScreenProps> = ({
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
	);
};
