export interface SessionStats {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export type ReviewPhase = 'question' | 'answer';
