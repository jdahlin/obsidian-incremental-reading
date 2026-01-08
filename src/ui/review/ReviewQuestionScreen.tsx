import type { FunctionalComponent } from 'preact';
import { formatClozeQuestion } from '../../core/cloze';
import { ReviewCard } from './ReviewCard';
import { ReviewShowAnswerButton } from './ReviewShowAnswerButton';
import './ReviewQuestionScreen.css';

export interface ReviewQuestionScreenProps {
	content: string;
	clozeIndex: number | null;
	onShowAnswer: () => void;
}

export const ReviewQuestionScreen: FunctionalComponent<ReviewQuestionScreenProps> = ({
	content,
	clozeIndex,
	onShowAnswer,
}) => {
	const displayContent = clozeIndex != null ? formatClozeQuestion(content, clozeIndex) : content;

	return (
		<div className="ir-review-screen">
			<ReviewCard content={displayContent} />
			<div className="ir-review-footer">
				<ReviewShowAnswerButton onShowAnswer={onShowAnswer} />
			</div>
		</div>
	);
};
