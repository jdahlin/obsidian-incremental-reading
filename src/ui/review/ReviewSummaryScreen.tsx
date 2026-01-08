import type { JSX } from 'preact';
import type { DeckInfo, StreakInfo, TodayStats } from '../../core/types';
import { DeckSummary } from './DeckSummary';

export function ReviewSummaryScreen(props: {
	decks: DeckInfo[];
	selectedPath: string | null;
	allCounts: { new: number; learning: number; due: number };
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
	onSelect: (path: string | null) => void;
	onStudy: () => void;
	onStats: () => void;
}): JSX.Element {
	return (
		<DeckSummary
			decks={props.decks}
			selectedPath={props.selectedPath}
			allCounts={props.allCounts}
			todayStats={props.todayStats}
			streak={props.streak}
			showStreak={props.showStreak}
			onSelect={props.onSelect}
			onStudy={props.onStudy}
			onStats={props.onStats}
		/>
	);
}
