import type { ReviewScreenActions, ReviewScreenState } from '@repo/core/review/types'
import type { FC } from 'react'
import { AnswerScreen } from './AnswerScreen'
import { FinishedScreen } from './FinishedScreen'
import { FolderScreen } from './FolderScreen'
import { QuestionScreen } from './QuestionScreen'

interface ReviewRouterProps {
	state: ReviewScreenState
	actions: ReviewScreenActions
}

export const ReviewRouter: FC<ReviewRouterProps> = ({ state, actions }) => {
	switch (state.type) {
		case 'folder':
			return (
				<FolderScreen
					decks={state.decks}
					selectedPath={state.selectedPath}
					allCounts={state.allCounts}
					todayStats={state.todayStats}
					onSelectDeck={actions.onSelectDeck}
					onStudy={actions.onStudy}
				/>
			)

		case 'question':
			return <QuestionScreen content={state.content} onShowAnswer={actions.onShowAnswer} />

		case 'answer':
			return <AnswerScreen content={state.content} onGrade={actions.onGrade} />

		case 'finished':
			return <FinishedScreen sessionStats={state.sessionStats} onBack={actions.onBack} />

		default:
			return <div className="ir-loading">Loading...</div>
	}
}
