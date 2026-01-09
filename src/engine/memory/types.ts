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
}

export interface EngineStore {
	createNote(content: string, options?: { title?: string; priority?: number }): string;
	createExtract(sourceId: string, start: number, end: number): string;
	addCloze(noteId: string, start: number, end: number, hint?: string): string;
	recordGrade(itemId: string, rating: number): void;
	recordAgain(itemId: string): void;
	recordPostpone(itemId: string, days: number): void;
	recordDismiss(itemId: string): void;
	recordPriority(itemId: string, value: number): void;
	recordScroll(itemId: string, value: number): void;
	recordShow(itemId: string, phase?: string): void;
	setSession(config: Record<string, unknown>): void;
	setScheduler(id: string): void;
	setClock(value: string): void;
	snapshot(): EngineSnapshot;
}
