import type { FunctionalComponent } from 'preact';

export interface ReviewCardProps {
	content: string;
}

export const ReviewCard: FunctionalComponent<ReviewCardProps> = ({ content }) => {
	return (
		<div className="ir-review-content">
			<div className="ir-review-card" dangerouslySetInnerHTML={{ __html: content }} />
		</div>
	);
};
