import type { FunctionalComponent } from 'preact'
import type { DebugInfo } from './review-screen-state'
import { ReviewCard } from './ReviewCard'
import { ReviewDebugInfo } from './ReviewDebugInfo'
import { ReviewGradeButtons } from './ReviewGradeButtons'
import { ReviewMoreMenu } from './ReviewMoreMenu'
import './ReviewAnswerScreen.css'

interface ReviewAnswerScreenProps {
	content: string
	debugInfo: DebugInfo
	canUndo: boolean
	onGrade: (grade: 1 | 2 | 3 | 4) => void | Promise<void>
	onEdit: () => void
	onSkip: () => void
	onUndo: () => void
	onSuspend: () => void
	onCardInfo: () => void
	onDelete: () => void
}

export const ReviewAnswerScreen: FunctionalComponent<ReviewAnswerScreenProps> = ({
	content,
	debugInfo,
	canUndo,
	onGrade,
	onEdit,
	onSkip,
	onUndo,
	onSuspend,
	onCardInfo,
	onDelete,
}) => {
	return (
		<div className="ir-review-screen">
			<ReviewMoreMenu
				onEdit={onEdit}
				onSkip={onSkip}
				onUndo={onUndo}
				onSuspend={onSuspend}
				onCardInfo={onCardInfo}
				onDelete={onDelete}
				canUndo={canUndo}
			/>
			<ReviewCard content={content} />
			<div className="ir-review-footer">
				<ReviewGradeButtons onGrade={onGrade} />
			</div>
			<ReviewDebugInfo info={debugInfo} />
		</div>
	)
}
