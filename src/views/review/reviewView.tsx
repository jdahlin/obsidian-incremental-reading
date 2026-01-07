import type { JSX } from 'preact';
import { MarkdownBlock } from './MarkdownBlock';
import { GradeBar } from './GradeBar';
import { ReviewItemView } from './ReviewItemView';
import type { QueueStats } from '../../scheduling/queue';
import type { SessionStats } from '../../review/grading';

export function ReviewView(props: {
	component: ReviewItemView;
	phase: 'question' | 'answer';
	onGrade: (n: number) => void;
	onShowAnswer: () => void;
	queueStats: QueueStats;
	sessionStats: SessionStats;
	upcomingInfo: { nextDue: Date | null; upcomingCount: number };
	extractTag: string;
}): JSX.Element {
	const card = props.component.getCurrentCard();
	const emptyState = !card;

	return (
		<div className="ir-review-root">
			<div className="ir-review-content">
				{emptyState ? (
					<div className="ir-review-empty">
						<div className="ir-review-empty-title">Done!</div>
						<div className="ir-review-empty-body">
							No more reviews for now.
						</div>

						{props.sessionStats.reviewed > 0 && (
							<div className="ir-review-session-stats">
								<div className="ir-review-session-row">
									<span>Reviewed:</span>
									<span className="ir-review-session-value">{props.sessionStats.reviewed}</span>
								</div>
								<div className="ir-review-session-row">
									<span className="ir-grade-again">Again:</span>
									<span className="ir-review-session-value">{props.sessionStats.again}</span>
								</div>
								<div className="ir-review-session-row">
									<span className="ir-grade-good">Good:</span>
									<span className="ir-review-session-value">{props.sessionStats.good}</span>
								</div>
							</div>
						)}

						{props.upcomingInfo.nextDue ? (
							<div className="ir-review-empty-next">
								Next: {formatDateTime(props.upcomingInfo.nextDue)}
							</div>
						) : null}
					</div>
				) : (
					<MarkdownBlock component={props.component} phase={props.phase} emptyText="" />
				)}
			</div>
			{emptyState ? null : (
				<div className="ir-review-footer">
					<GradeBar
						phase={props.phase}
						onGrade={props.onGrade}
						onShowAnswer={props.onShowAnswer}
					/>
				</div>
			)}
		</div>
	);
}

function formatDateTime(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	const hours = String(value.getHours()).padStart(2, '0');
	const minutes = String(value.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}
