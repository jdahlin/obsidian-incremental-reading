import type { FunctionalComponent } from 'preact';
import './DeckSummaryHeader.css';

export interface DeckSummaryHeaderProps {
	onStats: () => void;
	onStudy: () => void;
}

export const DeckSummaryHeader: FunctionalComponent<DeckSummaryHeaderProps> = ({
	onStats,
	onStudy,
}) => {
	return (
		<div className="ir-deck-header">
			<h2>Decks</h2>
			<div className="ir-deck-actions">
				<button type="button" className="ir-secondary" onClick={onStats}>
					Statistics
				</button>
				<button type="button" className="ir-primary" onClick={onStudy}>
					Study now
				</button>
			</div>
		</div>
	);
};
