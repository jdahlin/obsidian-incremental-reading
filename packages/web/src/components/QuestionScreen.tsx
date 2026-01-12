import type { FC } from 'react'
import { ReviewCard } from './ReviewCard'

interface QuestionScreenProps {
	content: string
	onShowAnswer: () => void
}

export const QuestionScreen: FC<QuestionScreenProps> = ({ content, onShowAnswer }) => {
	return (
		<div className="ir-review-screen">
			<ReviewCard content={content} />
			<div className="ir-review-footer">
				<button type="button" className="ir-btn ir-btn-primary" onClick={onShowAnswer}>
					Show Answer
				</button>
			</div>
		</div>
	)
}
