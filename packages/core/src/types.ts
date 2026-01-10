export type ItemType = 'topic' | 'cloze' | 'basic' | 'image_occlusion';
export type ReviewMode = 'review' | 'exam';
export type SessionStrategyId = 'JD1' | 'Anki';
export type SchedulerId = 'fsrs' | 'sm2';
export type Rating = 1 | 2 | 3 | 4;
export type Status = 'new' | 'learning' | 'review' | 'relearning';

export interface ItemState {
	status: Status;
	due: Date | null;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	last_review: Date | null;
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

export interface ReviewItem {
	id: string;
	noteId: string;
	notePath: string;
	type: ItemType;
	clozeIndex?: number | null;
	priority: number;
	created?: Date | null;
}

export interface ReviewState {
	status: Status;
	due: Date | null;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	lastReview: Date | null;
}

export interface SessionItem {
	item: ReviewItem;
	state: ReviewState;
	score: number;
}

export interface SessionState {
	pool: SessionItem[];
	volatileQueue: SessionItem[];
	currentIndex: number;
	historyIds: string[];
	scrollPos: Record<string, number>;
	seed: number;
}

export interface SchedulingParams {
	maximumInterval?: number;
	requestRetention?: number;
	weights?: number[];
}

export interface SessionConfig {
	strategy: SessionStrategyId;
	mode: ReviewMode;
	schedulerId?: SchedulerId;
	schedulingParams?: SchedulingParams;
	examDate?: Date | null;
	capacity?: number;
	clumpLimit?: number;
	cooldown?: number;
	newCardsLimit?: number;
	deterministic?: boolean;
}

export interface SessionStats {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

export interface Scheduler {
	grade: (state: ReviewState, rating: Rating, now: Date) => ReviewState;
	isDue: (state: ReviewState, now: Date) => boolean;
	applyExamAdjustment?: (state: ReviewState, examDate: Date, now: Date) => ReviewState;
}

export interface DataStore {
	listItems: () => Promise<ReviewItem[]>;
	getState: (itemId: string) => Promise<ReviewState | null>;
	setState: (itemId: string, state: ReviewState) => Promise<void>;
	appendReview: (record: ReviewRecord) => Promise<void>;
	setScrollPos: (itemId: string, pos: number) => Promise<void>;
	getScrollPos: (itemId: string) => Promise<number | null>;
}

export interface NotePlatform {
	getNote: (noteId: string) => Promise<string | null>;
	setNote: (noteId: string, content: string) => Promise<void>;
	getLinks: (noteId: string) => Promise<string[]>;
}

export interface NoteManipulator {
	createExtract: (source: string, start: number, end: number) => string;
	insertCloze: (source: string, start: number, end: number, hint?: string) => string;
	updateFrontmatter: (source: string, data: Record<string, unknown>) => string;
}

export interface ReviewRecord {
	ts: string;
	itemId: string;
	rating: Rating;
	elapsedMs?: number;
	stateBefore?: ReviewState['status'];
	stabilityBefore?: number;
	difficultyBefore?: number;
}
