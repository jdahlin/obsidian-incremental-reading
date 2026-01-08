import type { JSX } from 'preact';
import type { DeckInfo, StreakInfo, TodayStats } from '../../core/types';
import { DeckCounts } from './DeckCounts';
import { flattenDecks, rowClass } from './deck-summary-utils';

export function DeckSummary(props: {
	decks: DeckInfo[];
	selectedPath: string | null;
	allCounts: { new: number; learning: number; due: number };
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
	onSelect: (path: string | null) => void;
	onStudy: () => void;
	onStats: () => void;
}): JSX.Element {
	const rows = flattenDecks(props.decks);

	return (
		<div className="ir-deck-summary">
			<div className="ir-deck-header">
				<h2>Decks</h2>
				<div className="ir-deck-actions">
					<button type="button" className="ir-secondary" onClick={props.onStats}>
						Statistics
					</button>
					<button type="button" className="ir-primary" onClick={props.onStudy}>
						Study now
					</button>
				</div>
			</div>
			<div className="ir-deck-list">
				<div
					className={rowClass(props.selectedPath === null)}
					role="button"
					onClick={() => props.onSelect(null)}
					data-depth="0"
				>
					<span className="ir-deck-name">All decks</span>
					<DeckCounts counts={props.allCounts} />
				</div>
				{rows.map((row) => (
					<div
						key={row.path}
						className={rowClass(props.selectedPath === row.path)}
						role="button"
						data-depth={row.depth}
						onClick={() => props.onSelect(row.path)}
					>
						<span
							className="ir-deck-name"
							style={{ marginLeft: `${row.depth * 16}px` }}
						>
							{row.name}
						</span>
						<DeckCounts counts={row.counts} />
					</div>
				))}
			</div>
			<div className="ir-deck-footer">
				<span>Today: {props.todayStats.reviewed} reviewed</span>
				{props.showStreak ? <span>Streak: {props.streak.current} days</span> : null}
			</div>
		</div>
	);
}
