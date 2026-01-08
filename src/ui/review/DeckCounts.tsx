import type { JSX } from 'preact';

export function DeckCounts(props: {
	counts: { new: number; learning: number; due: number };
}): JSX.Element {
	return (
		<span className="ir-deck-counts">
			<span className="ir-count-new">{props.counts.new}</span>
			<span className="ir-count-learning">{props.counts.learning}</span>
			<span className="ir-count-due">{props.counts.due}</span>
		</span>
	);
}
