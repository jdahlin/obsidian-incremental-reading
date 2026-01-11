import type { FunctionalComponent } from 'preact'
import './ReviewCard.css'

interface ReviewCardProps {
	content: string
	showAnswer?: boolean
}

export const ReviewCard: FunctionalComponent<ReviewCardProps> = ({ content }) => {
	return (
		<div className="ir-review-content">
			<div className="ir-review-card" dangerouslySetInnerHTML={{ __html: content }} />
		</div>
	)
}
