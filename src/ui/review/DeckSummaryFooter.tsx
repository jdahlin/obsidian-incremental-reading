import type { FunctionalComponent } from 'preact';
import type { StreakInfo, TodayStats } from '../../core/types';

export interface DeckSummaryFooterProps {
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
}

export const DeckSummaryFooter: FunctionalComponent<DeckSummaryFooterProps> = ({
	todayStats,
	streak,
	showStreak,
}) => {
	return (
		<div className="ir-deck-footer">
			<span>Today: {todayStats.reviewed} reviewed</span>
			{showStreak ? <span>Streak: {streak.current} days</span> : null}
		</div>
	);
};
