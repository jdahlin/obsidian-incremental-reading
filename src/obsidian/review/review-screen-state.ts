import type { DeckInfo, StreakInfo, TodayStats } from '../../engine/core/types';
import type { DeckCountsValue } from './deck-summary-types';
import type { SessionStats } from './review-screen-types';

export interface DebugInfo {
	queue: string;
	status: string;
	priority: number;
	due: string | null;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
}

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
			debugInfo: DebugInfo;
	  }
	| {
			type: 'answer';
			content: string;
			debugInfo: DebugInfo;
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
	onGrade: (grade: number) => void | Promise<void>;
}
