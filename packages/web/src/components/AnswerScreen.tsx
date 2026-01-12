import type { FC } from 'react'
import { GradeButtons } from './GradeButtons'
import { ReviewCard } from './ReviewCard'

interface AnswerScreenProps {
	content: string
	onGrade: (grade: 1 | 2 | 3 | 4) => void | Promise<void>
}

export const AnswerScreen: FC<AnswerScreenProps> = ({ content, onGrade }) => {
	return (
		<div className="ir-review-screen">
			<ReviewCard content={content} />
			<div className="ir-review-footer">
				<GradeButtons onGrade={onGrade} />
			</div>
		</div>
	)
}
