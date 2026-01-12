import type { FC } from 'react'

interface ReviewCardProps {
	content: string
}

export const ReviewCard: FC<ReviewCardProps> = ({ content }) => {
	return (
		<div className="ir-review-content">
			<div className="ir-review-card" dangerouslySetInnerHTML={{ __html: content }} />
		</div>
	)
}
