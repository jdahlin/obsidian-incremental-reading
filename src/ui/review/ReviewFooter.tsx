import type { FunctionalComponent } from 'preact';
import type { ReviewPhase } from './review-screen-types';
import { ReviewGradeButtons } from './ReviewGradeButtons';
import { ReviewShowAnswerButton } from './ReviewShowAnswerButton';

export interface ReviewFooterProps {
	phase: ReviewPhase;
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}

export const ReviewFooter: FunctionalComponent<ReviewFooterProps> = ({
	phase,
	onShowAnswer,
	onGrade,
}) => {
	return (
		<div className="ir-review-footer">
			{phase === 'question' ? (
				<ReviewShowAnswerButton onShowAnswer={onShowAnswer} />
			) : (
				<ReviewGradeButtons onGrade={onGrade} />
			)}
		</div>
	);
};
