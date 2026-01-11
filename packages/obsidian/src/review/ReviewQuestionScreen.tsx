import type { FunctionalComponent } from 'preact'
import type { DebugInfo } from './review-screen-state'
import { formatClozeQuestion } from '@repo/core/core/cloze'
import { ReviewCard } from './ReviewCard'
import { ReviewDebugInfo } from './ReviewDebugInfo'
import { ReviewMoreMenu } from './ReviewMoreMenu'
import { ReviewShowAnswerButton } from './ReviewShowAnswerButton'
import './ReviewQuestionScreen.css'

interface ReviewQuestionScreenProps {
	content: string
	clozeIndex: number | null
	debugInfo: DebugInfo
	canUndo: boolean
	onShowAnswer: () => void
	onEdit: () => void
	onSkip: () => void
	onUndo: () => void
	onSuspend: () => void
	onCardInfo: () => void
	onDelete: () => void
}

export const ReviewQuestionScreen: FunctionalComponent<ReviewQuestionScreenProps> = ({
	content,
	clozeIndex,
	debugInfo,
	canUndo,
	onShowAnswer,
	onEdit,
	onSkip,
	onUndo,
	onSuspend,
	onCardInfo,
	onDelete,
}) => {
	const displayContent = clozeIndex != null ? formatClozeQuestion(content, clozeIndex) : content

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
			<ReviewCard content={displayContent} />
			<div className="ir-review-footer">
				<ReviewShowAnswerButton onShowAnswer={onShowAnswer} />
			</div>
			<ReviewDebugInfo info={debugInfo} />
		</div>
	)
}
