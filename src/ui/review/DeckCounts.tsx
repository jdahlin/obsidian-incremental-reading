import type { FunctionalComponent } from 'preact';

export interface DeckCountsProps {
	counts: { new: number; learning: number; due: number };
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
