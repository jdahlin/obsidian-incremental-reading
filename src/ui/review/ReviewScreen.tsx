import type { FunctionalComponent, JSX } from 'preact';
import type { QueueStats, ReviewItem } from '../../core/types';
import { formatClozeQuestion } from '../../core/cloze';

export interface SessionStats {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export interface ReviewScreenProps {
	selectedDeck: string | null;
	currentItem: ReviewItem | null;
	phase: 'question' | 'answer';
	queueStats: QueueStats;
	sessionStats: SessionStats;
	content: string;
	onBack: () => void;
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}

interface EmptyStateProps {
	sessionStats: SessionStats;
	onBack: () => void;
}

interface SessionSummaryProps {
	sessionStats: SessionStats;
}

interface ReviewCardProps {
	content: string;
}

interface ReviewFooterProps {
	phase: 'question' | 'answer';
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}

interface ShowAnswerButtonProps {
	onShowAnswer: () => void;
}

interface GradeButtonsProps {
	onGrade: (grade: number) => void;
}

export const ReviewScreen: FunctionalComponent<ReviewScreenProps> = ({
	currentItem,
	phase,
	sessionStats,
	content,
	onBack,
	onShowAnswer,
	onGrade,
}) => {
	const item = currentItem;

	if (!item) {
		return renderEmptyState({ sessionStats, onBack });
	}

	// Format cloze content in question phase to hide answers
	let displayContent = content;
	if (phase === 'question' && item.type === 'item' && item.clozeIndex != null) {
		displayContent = formatClozeQuestion(content, item.clozeIndex);
	}

	return (
		<div className="ir-review-screen">
			{renderReviewCard({ content: displayContent })}
			{renderReviewFooter({ phase, onShowAnswer, onGrade })}
		</div>
	);
};

function renderEmptyState({ sessionStats, onBack }: EmptyStateProps): JSX.Element {
	return (
		<div className="ir-review-screen">
			<div className="ir-review-content">
				<div className="ir-review-empty">
					<div className="ir-review-empty-title">Done!</div>
					<div className="ir-review-empty-body">No more reviews for now.</div>
					{renderSessionSummary({ sessionStats })}
					<button type="button" className="ir-secondary" onClick={onBack}>
						Back to decks
					</button>
				</div>
			</div>
		</div>
	);
}

function renderSessionSummary({ sessionStats }: SessionSummaryProps): JSX.Element | null {
	if (sessionStats.reviewed <= 0) return null;
	return (
		<div className="ir-review-session-summary">
			<div>Reviewed: {sessionStats.reviewed}</div>
			<div>
				Again: {sessionStats.again} | Good: {sessionStats.good}
			</div>
		</div>
	);
}

function renderReviewCard({ content }: ReviewCardProps): JSX.Element {
	return (
		<div className="ir-review-content">
			<div className="ir-review-card" dangerouslySetInnerHTML={{ __html: content }} />
		</div>
	);
}

function renderReviewFooter({ phase, onShowAnswer, onGrade }: ReviewFooterProps): JSX.Element {
	return (
		<div className="ir-review-footer">
			{phase === 'question'
				? renderShowAnswerButton({ onShowAnswer })
				: renderGradeButtons({ onGrade })}
		</div>
	);
}

function renderShowAnswerButton({ onShowAnswer }: ShowAnswerButtonProps): JSX.Element {
	return (
		<button type="button" className="ir-show-answer" onClick={onShowAnswer}>
			Show Answer
		</button>
	);
}

function renderGradeButtons({ onGrade }: GradeButtonsProps): JSX.Element {
	const grades = [
		{ value: 1, className: 'ir-grade ir-grade-again' },
		{ value: 2, className: 'ir-grade ir-grade-hard' },
		{ value: 3, className: 'ir-grade ir-grade-good' },
		{ value: 4, className: 'ir-grade ir-grade-easy' },
	];
	return (
		<div className="ir-grade-buttons">
			{grades.map((grade) => (
				<button
					key={grade.value}
					type="button"
					className={grade.className}
					onClick={() => onGrade(grade.value)}
				>
					{grade.value}
				</button>
			))}
		</div>
	);
}
