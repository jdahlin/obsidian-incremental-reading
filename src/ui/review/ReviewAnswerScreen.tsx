import type { FunctionalComponent } from 'preact';
import { ReviewCard } from './ReviewCard';
import { ReviewGradeButtons } from './ReviewGradeButtons';
import './ReviewAnswerScreen.css';

export interface ReviewAnswerScreenProps {
	content: string;
	onGrade: (grade: number) => void;
}

export const ReviewAnswerScreen: FunctionalComponent<ReviewAnswerScreenProps> = ({
	content,
	onGrade,
}) => {
	return (
		<div className="ir-review-screen">
			<ReviewCard content={content} />
			<div className="ir-review-footer">
				<ReviewGradeButtons onGrade={onGrade} />
			</div>
		</div>
	);
};
