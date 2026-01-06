export type Status = 'new' | 'learning' | 'review' | 'relearning';
export type CardType = 'topic' | 'item';

export interface CardState {
	// Identity
	source: string;
	type: CardType;

	// Scheduling
	created: Date;
	due: Date;
	status: Status;
	priority: number;
	last_review: Date | null;

	// FSRS fields
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;

	// Topic-specific
	scroll_pos: number;
}
