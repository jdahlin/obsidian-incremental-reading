import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { TFile } from 'obsidian';

export type Phase = 'question' | 'answer';

export interface ReviewState {
	phase: Phase;
	currentCard: TFile | null;
	queueLength: number;
	index: number;
}

export interface ReviewActions {
	grade: (n: number) => void;
	showAnswer: () => void;
	advance: () => void;
}

export interface ReviewContextValue {
	state: ReviewState;
	actions: ReviewActions;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReviewContext(): ReviewContextValue {
	const ctx = useContext(ReviewContext);
	if (!ctx) {
		throw new Error('useReviewContext must be used within ReviewContext.Provider');
	}
	return ctx;
}

export function useReviewState(): ReviewState {
	return useReviewContext().state;
}

export function useReviewActions(): ReviewActions {
	return useReviewContext().actions;
}

export function useCurrentCard(): TFile | null {
	return useReviewState().currentCard;
}

export function usePhase(): Phase {
	return useReviewState().phase;
}
