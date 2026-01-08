import type { FunctionalComponent } from 'preact';
import type { DeckInfo } from '../../core/types';
import type { DeckCountsValue } from './deck-summary-types';
import { DeckRow } from './DeckRow';

export interface DeckListProps {
	rows: DeckInfo[];
	selectedPath: string | null;
	allCounts: DeckCountsValue;
	onSelect: (path: string | null) => void;
}

export const DeckList: FunctionalComponent<DeckListProps> = ({
	rows,
	selectedPath,
	allCounts,
	onSelect,
}) => {
	return (
		<div className="ir-deck-list">
			<DeckRow
				key="all-decks"
				label="All decks"
				depth={0}
				counts={allCounts}
				selected={selectedPath === null}
				onSelect={() => onSelect(null)}
			/>
			{rows.map((row) => (
				<DeckRow
					key={row.path}
					label={row.name}
					depth={row.depth}
					counts={row.counts}
					selected={selectedPath === row.path}
					onSelect={() => onSelect(row.path)}
				/>
			))}
		</div>
	);
};
