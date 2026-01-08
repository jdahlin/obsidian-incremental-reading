import type { FunctionalComponent } from 'preact';
import type { SessionStats } from './review-screen-types';
import { ReviewSessionSummary } from './ReviewSessionSummary';
import './ReviewFinishedScreen.css';

export interface ReviewFinishedScreenProps {
	sessionStats: SessionStats;
	onBack: () => void;
}

export const ReviewFinishedScreen: FunctionalComponent<ReviewFinishedScreenProps> = ({
	sessionStats,
	onBack,
}) => {
	return (
		<div className="ir-review-screen">
			<div className="ir-review-content">
				<div className="ir-review-empty">
					<div className="ir-review-empty-title">Done!</div>
					<div className="ir-review-empty-body">No more reviews for now.</div>
					<ReviewSessionSummary sessionStats={sessionStats} />
					<button type="button" className="ir-secondary" onClick={onBack}>
						Back to decks
					</button>
				</div>
			</div>
		</div>
	);
};
