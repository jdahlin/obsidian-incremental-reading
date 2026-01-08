import type { JSX } from 'preact';
import type { QueueStats, ReviewItem } from '../../core/types';

export interface SessionStats {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export function ReviewScreen(props: {
	selectedDeck: string | null;
	currentItem: ReviewItem | null;
	phase: 'question' | 'answer';
	queueStats: QueueStats;
	sessionStats: SessionStats;
	content: string;
	onBack: () => void;
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}): JSX.Element {
	const item = props.currentItem;

	if (!item) {
		return (
			<div className="ir-review-screen">
				<div className="ir-review-content">
					<div className="ir-review-empty">
						<div className="ir-review-empty-title">Done!</div>
						<div className="ir-review-empty-body">No more reviews for now.</div>
						{props.sessionStats.reviewed > 0 && (
							<div className="ir-review-session-summary">
								<div>Reviewed: {props.sessionStats.reviewed}</div>
								<div>
									Again: {props.sessionStats.again} | Good:{' '}
									{props.sessionStats.good}
								</div>
							</div>
						)}
						<button type="button" className="ir-secondary" onClick={props.onBack}>
							Back to decks
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="ir-review-screen">
			<div className="ir-review-content">
				<div
					className="ir-review-card"
					dangerouslySetInnerHTML={{ __html: props.content }}
				/>
			</div>
			<div className="ir-review-footer">
				{props.phase === 'question' ? (
					<button type="button" className="ir-show-answer" onClick={props.onShowAnswer}>
						Show Answer
					</button>
				) : (
					<div className="ir-grade-buttons">
						<button
							type="button"
							className="ir-grade ir-grade-again"
							onClick={() => props.onGrade(1)}
						>
							1
						</button>
						<button
							type="button"
							className="ir-grade ir-grade-hard"
							onClick={() => props.onGrade(2)}
						>
							2
						</button>
						<button
							type="button"
							className="ir-grade ir-grade-good"
							onClick={() => props.onGrade(3)}
						>
							3
						</button>
						<button
							type="button"
							className="ir-grade ir-grade-easy"
							onClick={() => props.onGrade(4)}
						>
							4
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
