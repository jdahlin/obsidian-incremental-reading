import type { DeckInfo, TodayStats } from '@repo/core/core/types'
import type { DeckCounts } from '@repo/core/review/types'
import type { FC } from 'react'

interface FolderScreenProps {
	decks: readonly DeckInfo[]
	selectedPath: string | null
	allCounts: DeckCounts
	todayStats: TodayStats
	onSelectDeck: (path: string | null) => void
	onStudy: () => void | Promise<void>
}

export const FolderScreen: FC<FolderScreenProps> = ({
	decks,
	selectedPath,
	allCounts,
	todayStats,
	onSelectDeck,
	onStudy,
}) => {
	const totalDue = allCounts.new + allCounts.learning + allCounts.due

	return (
		<div className="ir-review-screen">
			<div className="ir-review-content">
				<h2>Review Decks</h2>

				<div className="ir-session-stats">
					<div className="ir-stat-row">
						<span>Today reviewed:</span>
						<span>{todayStats.reviewed}</span>
					</div>
					<div className="ir-stat-row">
						<span>New:</span>
						<span className="ir-count-new">{allCounts.new}</span>
					</div>
					<div className="ir-stat-row">
						<span>Learning:</span>
						<span className="ir-count-learning">{allCounts.learning}</span>
					</div>
					<div className="ir-stat-row">
						<span>Due:</span>
						<span className="ir-count-due">{allCounts.due}</span>
					</div>
				</div>

				{decks.length === 0 ? (
					<p>No decks found. Add some review items to get started.</p>
				) : (
					<div className="ir-deck-list">
						<div
							className={`ir-deck-row ${selectedPath === null ? 'selected' : ''}`}
							onClick={() => onSelectDeck(null)}
						>
							<span className="ir-deck-name">All Decks</span>
							<div className="ir-deck-counts">
								<span className="ir-count-new">{allCounts.new}</span>
								<span className="ir-count-learning">{allCounts.learning}</span>
								<span className="ir-count-due">{allCounts.due}</span>
							</div>
						</div>

						{decks.map((deck) => (
							<DeckRow
								key={deck.path}
								deck={deck}
								selectedPath={selectedPath}
								onSelect={onSelectDeck}
							/>
						))}
					</div>
				)}
			</div>

			<div className="ir-review-footer">
				<button
					type="button"
					className="ir-btn ir-btn-primary"
					onClick={() => void onStudy()}
					disabled={totalDue === 0}
				>
					Study ({totalDue})
				</button>
			</div>
		</div>
	)
}

interface DeckRowProps {
	deck: DeckInfo
	selectedPath: string | null
	onSelect: (path: string) => void
}

const DeckRow: FC<DeckRowProps> = ({ deck, selectedPath, onSelect }) => {
	const indent = deck.depth * 20

	return (
		<>
			<div
				className={`ir-deck-row ${selectedPath === deck.path ? 'selected' : ''}`}
				style={{ paddingLeft: `${16 + indent}px` }}
				onClick={() => onSelect(deck.path)}
			>
				<span className="ir-deck-name">{deck.name}</span>
				<div className="ir-deck-counts">
					<span className="ir-count-new">{deck.counts.new}</span>
					<span className="ir-count-learning">{deck.counts.learning}</span>
					<span className="ir-count-due">{deck.counts.due}</span>
				</div>
			</div>
			{deck.children.map((child) => (
				<DeckRow
					key={child.path}
					deck={child}
					selectedPath={selectedPath}
					onSelect={onSelect}
				/>
			))}
		</>
	)
}
