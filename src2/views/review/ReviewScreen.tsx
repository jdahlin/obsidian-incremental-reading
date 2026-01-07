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
	onBack: () => void;
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}): JSX.Element {
	const title = props.selectedDeck ?? 'All decks';
	const item = props.currentItem;

	return (
		<div className="ir-review-screen">
			<div className="ir-review-header">
				<button type="button" className="ir-secondary" onClick={props.onBack}>Back</button>
				<div className="ir-review-title">{title}</div>
				<div className="ir-review-stats">
					<span>New: {props.queueStats.new}</span>
					<span>Learning: {props.queueStats.learning}</span>
					<span>Due: {props.queueStats.due}</span>
				</div>
			</div>
			<div className="ir-review-body">
				{item ? (
					<div className="ir-review-item">
						<div className="ir-review-item-title"></div>
					</div>
				) : (
					<div className="ir-review-empty">
						<div className="ir-review-empty-title">All done for now</div>
						<div className="ir-review-empty-body">No items due in this deck.</div>
					</div>
				)}
			</div>
			{item ? (
				<div className="ir-review-footer">
					<button
						type="button"
						className="ir-secondary"
						onClick={props.onShowAnswer}
						disabled={item.type !== 'item' || props.phase === 'answer'}
					>
						Show answer
					</button>
					<div className="ir-grade-buttons">
						{[1, 2, 3, 4].map((grade) => (
							<button
								key={grade}
								type="button"
								className="ir-grade"
								onClick={() => props.onGrade(grade)}
							>
								{grade}
							</button>
						))}
					</div>
					<div className="ir-session-stats">
						<span>Reviewed: {props.sessionStats.reviewed}</span>
						<span>Again: {props.sessionStats.again}</span>
						<span>Hard: {props.sessionStats.hard}</span>
						<span>Good: {props.sessionStats.good}</span>
						<span>Easy: {props.sessionStats.easy}</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
