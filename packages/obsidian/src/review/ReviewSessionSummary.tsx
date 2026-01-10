import type { FunctionalComponent } from 'preact';
import type { SessionStats } from './review-screen-types';
import './ReviewSessionSummary.css';

export interface ReviewSessionSummaryProps {
	sessionStats: SessionStats;
}

export const ReviewSessionSummary: FunctionalComponent<ReviewSessionSummaryProps> = ({
	sessionStats,
}) => {
	if (sessionStats.reviewed <= 0) return null;

	return (
		<div className="ir-review-session-summary">
			<div>
				Reviewed:
				{sessionStats.reviewed}
			</div>
			<div>
				Again: {sessionStats.again} | Good:
				{sessionStats.good}
			</div>
		</div>
	);
};
