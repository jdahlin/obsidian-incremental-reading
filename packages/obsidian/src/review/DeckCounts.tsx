import type { FunctionalComponent } from 'preact';
import type { DeckCountsValue } from './deck-summary-types';
import './DeckCounts.css';

export interface DeckCountsProps {
	counts: DeckCountsValue;
}

export const DeckCounts: FunctionalComponent<DeckCountsProps> = ({ counts }) => {
	return (
		<span className="ir-deck-counts">
			<span className="ir-count-new">{counts.new}</span>
			<span className="ir-count-learning">{counts.learning}</span>
			<span className="ir-count-due">{counts.due}</span>
		</span>
	);
};
