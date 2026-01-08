import type { FunctionalComponent } from 'preact';
import { ReviewAnswerScreen } from './ReviewAnswerScreen';
import { ReviewFinishedScreen } from './ReviewFinishedScreen';
import { ReviewFolderScreen } from './ReviewFolderScreen';
import { ReviewQuestionScreen } from './ReviewQuestionScreen';
import type { ReviewScreenActions, ReviewScreenState } from './review-screen-state';

export interface ReviewScreenRouterProps {
	state: ReviewScreenState;
	actions: ReviewScreenActions;
}

export const ReviewScreenRouter: FunctionalComponent<ReviewScreenRouterProps> = ({
	state,
	actions,
}) => {
	switch (state.type) {
		case 'folder':
			return (
				<ReviewFolderScreen
					decks={state.decks}
					selectedPath={state.selectedPath}
					allCounts={state.allCounts}
					todayStats={state.todayStats}
					streak={state.streak}
					showStreak={state.showStreak}
					onSelect={actions.onSelectDeck}
					onStudy={actions.onStudy}
					onStats={actions.onStats}
				/>
			);
		case 'question':
			return (
				<ReviewQuestionScreen
					content={state.content}
					clozeIndex={state.clozeIndex}
					onShowAnswer={actions.onShowAnswer}
				/>
			);
		case 'answer':
			return <ReviewAnswerScreen content={state.content} onGrade={actions.onGrade} />;
		case 'finished':
			return (
				<ReviewFinishedScreen sessionStats={state.sessionStats} onBack={actions.onBack} />
			);
		default:
			return null;
	}
};
