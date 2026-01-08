import type { FunctionalComponent } from 'preact';

export interface ReviewShowAnswerButtonProps {
	onShowAnswer: () => void;
}

export const ReviewShowAnswerButton: FunctionalComponent<ReviewShowAnswerButtonProps> = ({
	onShowAnswer,
}) => {
	return (
		<button type="button" className="ir-show-answer" onClick={onShowAnswer}>
			Show Answer
		</button>
	);
};
