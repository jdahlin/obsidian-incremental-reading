import type { FunctionalComponent, JSX } from 'preact';
import type { DeckInfo, StreakInfo, TodayStats } from '../../core/types';
import { DeckCounts } from './DeckCounts';
import { flattenDecks, rowClass } from './deck-summary-utils';

type DeckCountsValue = { new: number; learning: number; due: number };

export interface DeckSummaryProps {
	decks: DeckInfo[];
	selectedPath: string | null;
	allCounts: DeckCountsValue;
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
	onSelect: (path: string | null) => void;
	onStudy: () => void;
	onStats: () => void;
}

interface DeckSummaryHeaderProps {
	onStats: () => void;
	onStudy: () => void;
}

interface DeckListProps {
	rows: DeckInfo[];
	selectedPath: string | null;
	allCounts: DeckCountsValue;
	onSelect: (path: string | null) => void;
}

interface DeckRowProps {
	label: string;
	depth: number;
	counts: DeckCountsValue;
	selected: boolean;
	onSelect: () => void;
	rowKey?: string;
}

interface DeckSummaryFooterProps {
	todayStats: TodayStats;
	streak: StreakInfo;
	showStreak: boolean;
}

export const DeckSummary: FunctionalComponent<DeckSummaryProps> = ({
	decks,
	selectedPath,
	allCounts,
	todayStats,
	streak,
	showStreak,
	onSelect,
	onStudy,
	onStats,
}) => {
	const rows = flattenDecks(decks);

	return (
		<div className="ir-deck-summary">
			{renderDeckSummaryHeader({ onStats, onStudy })}
			{renderDeckList({ rows, selectedPath, allCounts, onSelect })}
			{renderDeckSummaryFooter({ todayStats, streak, showStreak })}
		</div>
	);
};

function renderDeckSummaryHeader({ onStats, onStudy }: DeckSummaryHeaderProps): JSX.Element {
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
}

function renderDeckList({ rows, selectedPath, allCounts, onSelect }: DeckListProps): JSX.Element {
	return (
		<div className="ir-deck-list">
			{renderDeckRow({
				label: 'All decks',
				depth: 0,
				counts: allCounts,
				selected: selectedPath === null,
				onSelect: () => onSelect(null),
				rowKey: 'all-decks',
			})}
			{rows.map((row) =>
				renderDeckRow({
					label: row.name,
					depth: row.depth,
					counts: row.counts,
					selected: selectedPath === row.path,
					onSelect: () => onSelect(row.path),
					rowKey: row.path,
				}),
			)}
		</div>
	);
}

function renderDeckRow({
	label,
	depth,
	counts,
	selected,
	onSelect,
	rowKey,
}: DeckRowProps): JSX.Element {
	return (
		<div
			key={rowKey}
			className={rowClass(selected)}
			role="button"
			onClick={onSelect}
			data-depth={depth}
		>
			<span className="ir-deck-name" style={{ marginLeft: `${depth * 16}px` }}>
				{label}
			</span>
			<DeckCounts counts={counts} />
		</div>
	);
}

function renderDeckSummaryFooter({
	todayStats,
	streak,
	showStreak,
}: DeckSummaryFooterProps): JSX.Element {
	return (
		<div className="ir-deck-footer">
			<span>Today: {todayStats.reviewed} reviewed</span>
			{showStreak ? <span>Streak: {streak.current} days</span> : null}
		</div>
	);
}
