import type { FunctionalComponent } from 'preact';
import { formatClozeQuestion } from '../../engine/core/cloze';
import { ReviewCard } from './ReviewCard';
import { ReviewShowAnswerButton } from './ReviewShowAnswerButton';
import { ReviewDebugInfo } from './ReviewDebugInfo';
import type { DebugInfo } from './review-screen-state';
import './ReviewQuestionScreen.css';

export interface ReviewQuestionScreenProps {
	content: string;
	clozeIndex: number | null;
	debugInfo: DebugInfo;
	onShowAnswer: () => void;
}

export const ReviewQuestionScreen: FunctionalComponent<ReviewQuestionScreenProps> = ({
	content,
	clozeIndex,
	debugInfo,
	onShowAnswer,
}) => {
	const displayContent = clozeIndex != null ? formatClozeQuestion(content, clozeIndex) : content;

	return (
		<div className="ir-review-screen">
			<ReviewCard content={displayContent} />
			<div className="ir-review-footer">
				<ReviewShowAnswerButton onShowAnswer={onShowAnswer} />
			</div>
			<ReviewDebugInfo info={debugInfo} />
		</div>
	);
};
