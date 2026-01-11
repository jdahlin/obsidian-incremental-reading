import type { DataStore, Rating, ReviewItem, ReviewRecord, ReviewState } from '../types'
import type { EngineSnapshot, EngineStore } from './types'
import { getScheduler } from '../scheduling'

interface NoteRecord {
	id: string
	content: string
	title?: string
	priority?: number
}

interface ClozeRecord {
	id: string
	noteId: string
	start: number
	end: number
	hint?: string
}

interface GradeRecord {
	itemId: string
	rating: number
}

interface PostponeRecord {
	itemId: string
	days: number
}

interface ShowRecord {
	itemId: string
	phase?: string
}

interface SessionConfig {
	strategy: string
	examDate: string | null
	capacity?: number
	clump?: number
	cooldown?: number
	newCardsLimit?: number
	folder?: string
	counts?: { new: number; learning: number; due: number }
	sessionStats?: { reviewed: number; again: number; hard: number; good: number; easy: number }
}

interface EngineState {
	notes: Record<string, NoteRecord>
	clozes: Record<string, ClozeRecord>
	states: Record<string, ReviewState>
	grades: GradeRecord[]
	again: string[]
	history: string[]
	postponed: PostponeRecord[]
	dismissed: string[]
	priority: Record<string, number>
	scroll: Record<string, number>
	shown: ShowRecord[]
	due: Record<string, string>
	clock: string | null
	session: SessionConfig
	scheduler: string
	nextItem: string | null
	nextItems: string[]
	// New field for persistent review logs (DataStore.appendReview)
	reviewLogs: ReviewRecord[]
}

export class MemoryDataStore implements EngineStore, DataStore {
	private noteCounter = 0
	private clozeCounters = new Map<string, number>()
	private state: EngineState = {
		notes: {},
		clozes: {},
		states: {},
		grades: [],
		again: [],
		history: [],
		postponed: [],
		dismissed: [],
		priority: {},
		scroll: {},
		shown: [],
		due: {},
		clock: null,
		session: { strategy: 'JD1', examDate: null },
		scheduler: 'fsrs',
		nextItem: null,
		nextItems: [],
		reviewLogs: [],
	}

	// --- EngineStore Implementation ---

	async createNote(
		content: string,
		options: { title?: string; priority?: number } = {},
	): Promise<string> {
		const noteId = this.nextNoteId()
		this.state.notes[noteId] = { id: noteId, content, ...options }
		return noteId
	}

	async createExtract(sourceId: string, start: number, end: number): Promise<string> {
		const noteId = this.nextNoteId()
		this.state.notes[noteId] = {
			id: noteId,
			content: `extract:${sourceId}:${start}-${end}`,
		}
		return noteId
	}

	async addCloze(noteId: string, start: number, end: number, hint?: string): Promise<string> {
		const clozeId = this.nextClozeId(noteId)
		this.state.clozes[clozeId] = { id: clozeId, noteId, start, end, hint }
		return clozeId
	}

	async recordGrade(itemId: string, rating: number): Promise<void> {
		this.state.grades.push({ itemId, rating })
		if (itemId) this.state.history.push(itemId)
		if (itemId) {
			const now = this.getNow()
			const scheduler = getScheduler(this.state.scheduler)
			let itemState = this.state.states[itemId] || this.getInitialState()

			// Grade
			itemState = scheduler.grade(itemState, rating as Rating, now)

			// Apply exam adjustment
			if (
				this.state.session.examDate !== null &&
				this.state.session.examDate !== '' &&
				scheduler.applyExamAdjustment !== undefined
			) {
				const examDate = new Date(this.state.session.examDate)
				itemState = scheduler.applyExamAdjustment(itemState, examDate, now)
			}

			this.state.states[itemId] = itemState

			// Update legacy due map
			if (itemState.due) {
				this.state.due[itemId] = formatDate(itemState.due)
			}
		}
	}

	async recordAgain(itemId: string): Promise<void> {
		if (itemId) this.state.again.push(itemId)
	}

	async recordPostpone(itemId: string, days: number): Promise<void> {
		this.state.postponed.push({ itemId, days })

		const now = this.getNow()
		const currentState = this.state.states[itemId] || this.getInitialState()
		const newDue = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

		const newState: ReviewState = {
			...currentState,
			due: newDue,
			status: currentState.status === 'new' ? 'review' : currentState.status,
		}

		this.state.states[itemId] = newState
		this.state.due[itemId] = formatDate(newDue)
	}

	async recordDismiss(itemId: string): Promise<void> {
		if (itemId) this.state.dismissed.push(itemId)
	}

	async recordPriority(itemId: string, value: number): Promise<void> {
		if (itemId) this.state.priority[itemId] = value
	}

	async recordScroll(itemId: string, value: number): Promise<void> {
		if (itemId) this.state.scroll[itemId] = value
	}

	async recordShow(itemId: string, phase?: string): Promise<void> {
		this.state.shown.push({ itemId, phase })
	}

	setNextItem(itemId: string | null): void {
		this.state.nextItem = itemId
	}

	setNextItems(itemIds: string[]): void {
		this.state.nextItems = itemIds
	}

	setSession(config: Record<string, unknown>): void {
		this.state.session = {
			strategy: String((config.strategy as string) ?? this.state.session.strategy),
			examDate: (config.examDate as string | null) ?? null,
			capacity: config.capacity as number | undefined,
			clump: config.clump as number | undefined,
			cooldown: config.cooldown as number | undefined,
			newCardsLimit: config.newCardsLimit as number | undefined,
			folder: config.folder as string | undefined,
			counts: config.counts as SessionConfig['counts'],
			sessionStats: config.sessionStats as SessionConfig['sessionStats'],
		}
	}

	setScheduler(id: string): void {
		this.state.scheduler = id
	}

	setClock(value: string): void {
		this.state.clock = value
	}

	getClock(): string | null {
		return this.state.clock
	}

	async snapshot(): Promise<EngineSnapshot> {
		return {
			notes: sortRecord(this.state.notes),
			clozes: sortRecord(this.state.clozes),
			states: this.mapStatesToSnapshot(this.state.states),
			grades: this.state.grades.slice() as unknown as Record<string, unknown>[],
			again: this.state.again.slice(),
			history: this.state.history.slice(),
			postponed: this.state.postponed.slice() as unknown as Record<string, unknown>[],
			dismissed: this.state.dismissed.slice(),
			priority: sortRecord(this.state.priority),
			scroll: sortRecord(this.state.scroll),
			shown: this.state.shown.slice() as unknown as Record<string, unknown>[],
			due: sortRecord(this.state.due),
			clock: this.state.clock,
			session: { ...this.state.session, nextItem: this.state.nextItem },
			scheduler: this.state.scheduler,
			stats: buildStats(this.state),
			queue: this.state.nextItems.slice(),
		}
	}

	// --- DataStore Implementation ---

	async listItems(): Promise<ReviewItem[]> {
		const items: ReviewItem[] = []

		// Topics (Notes)
		for (const note of Object.values(this.state.notes)) {
			// Skip if dismissed
			if (this.state.dismissed.includes(note.id)) continue

			items.push({
				id: note.id,
				noteId: note.id,
				notePath: `memory://${note.id}`,
				type: 'topic',
				priority: this.state.priority[note.id] ?? note.priority ?? 50,
				created: new Date(), // Dummy
			})
		}

		// Clozes
		for (const cloze of Object.values(this.state.clozes)) {
			if (this.state.dismissed.includes(cloze.id)) continue

			const notePriority =
				this.state.priority[cloze.noteId] ?? this.state.notes[cloze.noteId]?.priority ?? 50
			const clozePriority = this.state.priority[cloze.id] ?? notePriority

			items.push({
				id: cloze.id,
				noteId: cloze.noteId,
				notePath: `memory://${cloze.noteId}`,
				type: 'cloze',
				clozeIndex: Number.parseInt(cloze.id.split('::c')[1] ?? '0', 10),
				priority: clozePriority,
				created: new Date(), // Dummy
			})
		}

		return items
	}

	async getState(itemId: string): Promise<ReviewState | null> {
		return this.state.states[itemId] || null
	}

	async setState(itemId: string, state: ReviewState): Promise<void> {
		this.state.states[itemId] = state
		if (state.due) {
			this.state.due[itemId] = formatDate(state.due)
		}
	}

	async appendReview(record: ReviewRecord): Promise<void> {
		this.state.reviewLogs.push(record)
		// Update legacy tracking for tests
		this.state.grades.push({ itemId: record.itemId, rating: record.rating })
		if (record.itemId) {
			this.state.history.push(record.itemId)
		}
		if (record.rating === 1 && record.itemId) {
			this.state.again.push(record.itemId)
		}
	}

	async setScrollPos(itemId: string, pos: number): Promise<void> {
		this.state.scroll[itemId] = pos
	}

	async getScrollPos(itemId: string): Promise<number | null> {
		return this.state.scroll[itemId] ?? null
	}

	// --- Private Helpers ---

	private nextNoteId(): string {
		this.noteCounter += 1
		return `note-${this.noteCounter}`
	}

	private nextClozeId(noteId: string): string {
		const next = (this.clozeCounters.get(noteId) ?? 0) + 1
		this.clozeCounters.set(noteId, next)
		return `${noteId}::c${next}`
	}

	private getNow(): Date {
		if (this.state.clock !== undefined && this.state.clock !== '') {
			const parsed = new Date(`${this.state.clock}T00:00:00Z`)
			if (!Number.isNaN(parsed.getTime())) return parsed
		}
		return new Date(0)
	}

	private getInitialState(): ReviewState {
		return {
			status: 'new',
			due: null,
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
		}
	}

	private mapStatesToSnapshot(states: Record<string, ReviewState>): Record<string, unknown> {
		const result: Record<string, unknown> = {}
		for (const key of Object.keys(states)) {
			result[key] = states[key] // Directly expose for now
		}
		return sortRecord(result)
	}
}

function buildStats(state: EngineState): Record<string, unknown> {
	const noteCount = Object.keys(state.notes).length
	const clozeCount = Object.keys(state.clozes).length
	const itemCount = noteCount + clozeCount
	return {
		notes: { count: noteCount },
		clozes: { count: clozeCount },
		grades: { count: state.grades.length },
		again: { count: state.again.length },
		history: { count: state.history.length },
		postponed: { count: state.postponed.length },
		dismissed: { count: state.dismissed.length },
		priority: { count: Object.keys(state.priority).length },
		scroll: { count: Object.keys(state.scroll).length },
		shown: { count: state.shown.length },
		due: { count: Object.keys(state.due).length },
		queue: {
			total: itemCount,
			new: itemCount,
			due: 0,
			learning: 0,
		},
		session: {
			poolSize: itemCount,
			volatileSize: state.again.length,
			historySize: state.history.length,
		},
	}
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
	return Object.keys(record)
		.sort()
		.reduce<Record<string, T>>((acc, key) => {
			const value = record[key]
			if (value !== undefined) {
				acc[key] = value
			}
			return acc
		}, {})
}

function formatDate(date: Date): string {
	const year = date.getUTCFullYear()
	const month = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day = String(date.getUTCDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
