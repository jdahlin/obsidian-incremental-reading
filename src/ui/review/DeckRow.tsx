import type { FunctionalComponent } from 'preact';
import { DeckCounts } from './DeckCounts';
import { rowClass } from './deck-summary-utils';
import type { DeckCountsValue } from './deck-summary-types';

export interface DeckRowProps {
	label: string;
	depth: number;
	counts: DeckCountsValue;
	selected: boolean;
	onSelect: () => void;
}

export const DeckRow: FunctionalComponent<DeckRowProps> = ({
	label,
	depth,
	counts,
	selected,
	onSelect,
}) => {
	return (
		<div className={rowClass(selected)} role="button" onClick={onSelect} data-depth={depth}>
			<span className="ir-deck-name" style={{ marginLeft: `${depth * 16}px` }}>
				{label}
			</span>
			<DeckCounts counts={counts} />
		</div>
	);
};
