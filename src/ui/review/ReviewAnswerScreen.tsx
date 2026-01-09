import type { FunctionalComponent } from 'preact';
import { ReviewCard } from './ReviewCard';
import { ReviewGradeButtons } from './ReviewGradeButtons';
import { ReviewDebugInfo } from './ReviewDebugInfo';
import type { DebugInfo } from './review-screen-state';
import './ReviewAnswerScreen.css';

export interface ReviewAnswerScreenProps {
	content: string;
	debugInfo: DebugInfo;
	onGrade: (grade: number) => void | Promise<void>;
}

export const ReviewAnswerScreen: FunctionalComponent<ReviewAnswerScreenProps> = ({
	content,
	debugInfo,
	onGrade,
}) => {
	return (
		<div className="ir-review-screen">
			<ReviewCard content={content} />
			<div className="ir-review-footer">
				<ReviewGradeButtons onGrade={onGrade} />
			</div>
			<ReviewDebugInfo info={debugInfo} />
		</div>
	);
};
