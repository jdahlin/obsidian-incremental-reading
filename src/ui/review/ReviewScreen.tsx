import type { FunctionalComponent } from 'preact';
import type { QueueStats, ReviewItem } from '../../core/types';
import { formatClozeQuestion } from '../../core/cloze';
import { ReviewCard } from './ReviewCard';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewFooter } from './ReviewFooter';
import type { ReviewPhase, SessionStats } from './review-screen-types';

export interface ReviewScreenProps {
	selectedDeck: string | null;
	currentItem: ReviewItem | null;
	phase: ReviewPhase;
	queueStats: QueueStats;
	sessionStats: SessionStats;
	content: string;
	onBack: () => void;
	onShowAnswer: () => void;
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
		return <ReviewEmptyState sessionStats={sessionStats} onBack={onBack} />;
	}

	// Format cloze content in question phase to hide answers
	let displayContent = content;
	if (phase === 'question' && item.type === 'item' && item.clozeIndex != null) {
		displayContent = formatClozeQuestion(content, item.clozeIndex);
	}

	return (
		<div className="ir-review-screen">
			<ReviewCard content={displayContent} />
			<ReviewFooter phase={phase} onShowAnswer={onShowAnswer} onGrade={onGrade} />
		</div>
	);
};
