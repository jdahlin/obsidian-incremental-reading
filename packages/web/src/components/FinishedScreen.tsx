import type { SessionStats } from '@repo/core/review/types'
import type { FC } from 'react'

interface FinishedScreenProps {
	sessionStats: SessionStats
	onBack: () => void | Promise<void>
}

export const FinishedScreen: FC<FinishedScreenProps> = ({ sessionStats, onBack }) => {
	return (
		<div className="ir-review-screen">
			<div className="ir-finished">
				<div className="ir-finished-title">Done!</div>
				<p>No more reviews for now.</p>

				<div className="ir-session-stats">
					<div className="ir-stat-row">
						<span>Reviewed:</span>
						<span>{sessionStats.reviewed}</span>
					</div>
					<div className="ir-stat-row">
						<span>Again:</span>
						<span>{sessionStats.again}</span>
					</div>
					<div className="ir-stat-row">
						<span>Hard:</span>
						<span>{sessionStats.hard}</span>
					</div>
					<div className="ir-stat-row">
						<span>Good:</span>
						<span>{sessionStats.good}</span>
					</div>
					<div className="ir-stat-row">
						<span>Easy:</span>
						<span>{sessionStats.easy}</span>
					</div>
				</div>

				<button
					type="button"
					className="ir-btn ir-btn-secondary"
					onClick={() => void onBack()}
				>
					Back to decks
				</button>
			</div>
		</div>
	)
}
