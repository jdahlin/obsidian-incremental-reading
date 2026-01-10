import type { StreakInfo, TodayStats } from '@repo/core/core/types';
import type { FunctionalComponent } from 'preact';
import './DeckSummaryFooter.css';

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
			<span>
				Today:
				{todayStats.reviewed} reviewed
			</span>
			{showStreak ? (
				<span>
					Streak:
					{streak.current} days
				</span>
			) : null}
		</div>
	);
};
