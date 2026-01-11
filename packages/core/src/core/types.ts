export type Status = 'new' | 'learning' | 'review' | 'relearning';
export type CardType = 'topic' | 'item' | 'basic' | 'image_occlusion';
export type Rating = 1 | 2 | 3 | 4;

export interface ItemState {
	status: Status;
	due: Date | null;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	last_review: Date | null;
}

export interface ReviewItem {
	id: string;
	noteId: string;
	notePath: string;
	noteFile?: unknown;
	type: CardType;
	clozeIndex?: number | null;
	state: ItemState;
	priority: number;
	created?: Date | null;
}

export interface ReviewPlatformAdapter {
	getTodayStats: (now: Date) => Promise<TodayStats>;
	getStreakInfo: (now: Date) => Promise<StreakInfo>;
	renderItem: (
		item: ReviewItem,
		phase: 'question' | 'answer',
		extractTag: string,
	) => Promise<string>;
	openStats: (extractTag: string) => void;
	getPreselectedPath: (decks: DeckInfo[]) => string | null;
	onDataChange: (handler: () => void) => () => void;
}

export interface NoteFrontmatter {
	ir_note_id: string;
	tags: string[];
	source?: string;
	type: CardType;
	created?: Date | null;
	priority: number;
}

export interface ReviewRecord {
	ts: string;
	item_id: string;
	rating: Rating;
	elapsed_ms?: number;
	state_before?: Status;
	stability_before?: number;
	difficulty_before?: number;
}

export interface TodayStats {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export interface StreakInfo {
	current: number;
	longest: number;
}

export interface DeckInfo {
	path: string;
	name: string;
	depth: number;
	counts: {
		new: number;
		learning: number;
		due: number;
	};
	children: DeckInfo[];
	collapsed: boolean;
}
