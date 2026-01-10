export interface EngineSnapshot {
	notes: Record<string, unknown>;
	clozes: Record<string, unknown>;
	states: Record<string, unknown>;
	grades: Record<string, unknown>[];
	again: string[];
	history: string[];
	postponed: Record<string, unknown>[];
	dismissed: string[];
	priority: Record<string, number>;
	scroll: Record<string, number>;
	shown: Record<string, unknown>[];
	due: Record<string, string>;
	clock: string | null;
	session: Record<string, unknown>;
	scheduler: string;
	stats: Record<string, unknown>;
	queue: string[];
}

export interface EngineStore {
	createNote(content: string, options?: { title?: string; priority?: number }): Promise<string>;
	createExtract(sourceId: string, start: number, end: number): Promise<string>;
	addCloze(noteId: string, start: number, end: number, hint?: string): Promise<string>;
	recordGrade(itemId: string, rating: number): Promise<void>;
	recordAgain(itemId: string): Promise<void>;
	recordPostpone(itemId: string, days: number): Promise<void>;
	recordDismiss(itemId: string): Promise<void>;
	recordPriority(itemId: string, value: number): Promise<void>;
	recordScroll(itemId: string, value: number): Promise<void>;
	recordShow(itemId: string, phase?: string): Promise<void>;
	setNextItem(itemId: string | null): void;
	setNextItems(itemIds: string[]): void;
	setSession(config: Record<string, unknown>): void;
	setScheduler(id: string): void;
	setClock(value: string): void;
	getClock(): string | null;
	snapshot(): Promise<EngineSnapshot>;
}
