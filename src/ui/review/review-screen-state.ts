import type { DeckInfo, StreakInfo, TodayStats } from '../../core/types';
import type { DeckCountsValue } from './deck-summary-types';
import type { SessionStats } from './review-screen-types';

export type ReviewScreenState =
	| {
			type: 'folder';
			decks: DeckInfo[];
			selectedPath: string | null;
			allCounts: DeckCountsValue;
			todayStats: TodayStats;
			streak: StreakInfo;
			showStreak: boolean;
	  }
	| {
			type: 'question';
			content: string;
			clozeIndex: number | null;
	  }
	| {
			type: 'answer';
			content: string;
	  }
	| {
			type: 'finished';
			sessionStats: SessionStats;
	  };

export interface ReviewScreenActions {
	onSelectDeck: (path: string | null) => void;
	onStudy: () => void;
	onStats: () => void;
	onBack: () => void;
	onShowAnswer: () => void;
	onGrade: (grade: number) => void;
}
