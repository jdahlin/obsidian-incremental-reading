import type { FileSystem } from '../data/FileSystem'
import type { MarkdownDataStore } from '../data/MarkdownDataStore'
import type { EngineSnapshot, EngineStore } from '../memory/types'
import type { ReviewState } from '../types'
import { load as parse, dump as stringify } from 'js-yaml'

interface SidecarClozeEntry {
	cloze_uid: string
	status: string
	start?: number
	end?: number
	hint?: string
}

interface SidecarData {
	ir_note_id: string
	note_path: string
	type: string
	priority: number
	clozes?: Record<string, SidecarClozeEntry>
}

export class MarkdownEngineStore implements EngineStore {
	private noteCounter = 0
	private clozeCounters = new Map<string, number>()
	private runtime = {
		clock: null as string | null,
		session: { strategy: 'JD1' as const, examDate: null, deterministic: true } as Record<
			string,
			unknown
		>,
		scheduler: 'fsrs',
		nextItem: null as string | null,
		nextItems: [] as string[],
		dismissed: [] as string[],
		postponed: [] as { itemId: string; days: number }[],
		shown: [] as { itemId: string; phase?: string }[],
	}

	constructor(
		private dataStore: MarkdownDataStore,
		private fs: FileSystem,
	) {}

	// --- EngineStore Mutations ---

	async createNote(
		content: string,
		options: { title?: string; priority?: number } = {},
	): Promise<string> {
		this.noteCounter++
		const id = `note-${this.noteCounter}`
		const path = `${id}.md`

		let fileContent = content
		if (options.priority || options.title) {
			const fm: Record<string, unknown> = {}
			if (options.priority) fm.priority = options.priority
			if (options.title) fm.title = options.title
			fm.ir_note_id = id
			fileContent = `---\n${JSON.stringify(fm)}
---\n${content}`
		} else {
			fileContent = `---
ir_note_id: ${id}
---
${content}`
		}

		await this.fs.write(path, fileContent)

		const sidecarPath = `IR/Review Items/${id}.md`
		const yaml = `ir_note_id: ${id}
note_path: ${path}
type: topic
priority: ${options.priority ?? 50}
topic:\n  status: new`
		await this.fs.write(
			sidecarPath,
			`---
${yaml}
---
`,
		)

		return id
	}

	async createExtract(sourceId: string, start: number, end: number): Promise<string> {
		this.noteCounter++
		const id = `note-${this.noteCounter}`
		const path = `${id}.md`
		const sidecarPath = `IR/Review Items/${id}.md`
		const yaml = `ir_note_id: ${id}
note_path: ${path}
type: topic
priority: 50
topic:\n  status: new`
		await this.fs.write(
			sidecarPath,
			`---
${yaml}
---
`,
		)

		await this.fs.write(
			path,
			`---
ir_note_id: ${id}
---
extract:${sourceId}:${start}-${end}`,
		)
		return id
	}

	async addCloze(noteId: string, start: number, end: number, hint?: string): Promise<string> {
		const next = (this.clozeCounters.get(noteId) ?? 0) + 1
		this.clozeCounters.set(noteId, next)
		const clozeId = `${noteId}::c${next}`
		const clozeKey = `c${next}`

		const sidecarPath = `IR/Review Items/${noteId}.md`

		await this.updateSidecarWithCloze(sidecarPath, clozeKey, start, end, hint)

		return clozeId
	}

	private async updateSidecarWithCloze(
		path: string,
		clozeKey: string,
		start: number,
		end: number,
		hint?: string,
	) {
		await this.updateSidecar(path, (data: SidecarData) => {
			if (!data.clozes) data.clozes = {}
			data.clozes[clozeKey] = {
				cloze_uid: Math.random().toString(36).substring(2, 12),
				status: 'new',
				start,
				end,
				hint,
			}
			return data
		})
	}

	async recordGrade(_itemId: string, _rating: number): Promise<void> {
		// Handled by SessionManager -> MarkdownDataStore
	}

	async recordAgain(_itemId: string): Promise<void> {} // Handled by SessionManager

	async recordPostpone(itemId: string, days: number): Promise<void> {
		this.runtime.postponed.push({ itemId, days })

		const now = this.runtime.clock ? new Date(`${this.runtime.clock}T00:00:00Z`) : new Date()
		const newDue = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

		const state = await this.dataStore.getState(itemId)
		if (state) {
			const newState: ReviewState = {
				...state,
				due: newDue,
				status: state.status === 'new' ? 'review' : state.status,
			}
			await this.dataStore.setState(itemId, newState)
		}
	}

	async recordDismiss(itemId: string): Promise<void> {
		this.runtime.dismissed.push(itemId)
	}

	async recordPriority(itemId: string, value: number): Promise<void> {
		const { noteId, clozeKey } = this.parseItemId(itemId)
		const sidecarPath = `IR/Review Items/${noteId}.md`

		await this.updateSidecar(sidecarPath, (data: SidecarData) => {
			if (!clozeKey) data.priority = value
			return data
		})
	}

	async recordScroll(itemId: string, value: number): Promise<void> {
		await this.dataStore.setScrollPos(itemId, value)
	}

	async recordShow(itemId: string, phase?: string): Promise<void> {
		this.runtime.shown.push({ itemId, phase })
	}

	setNextItem(itemId: string | null): void {
		this.runtime.nextItem = itemId
	}

	setNextItems(itemIds: string[]): void {
		this.runtime.nextItems = itemIds
	}

	setSession(config: Record<string, unknown>): void {
		this.runtime.session = { ...this.runtime.session, ...config }
	}

	setScheduler(id: string): void {
		this.runtime.scheduler = id
	}

	setClock(value: string): void {
		this.runtime.clock = value
	}

	getClock(): string | null {
		return this.runtime.clock
	}

	async snapshot(): Promise<EngineSnapshot> {
		const items = await this.dataStore.listItems()

		const notes: Record<string, unknown> = {}
		const clozes: Record<string, unknown> = {}
		const states: Record<string, unknown> = {}
		const due: Record<string, string> = {}
		const priority: Record<string, number> = {}
		const scroll: Record<string, number> = {}

		for (const item of items) {
			if (item.type === 'topic') {
				const content = (await this.fs.read(item.notePath)) ?? ''
				const body = content.replace(/^---\n[\s\S]*?\n---\n/, '')

				// Parse frontmatter for scroll_pos
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
				if (fmMatch) {
					try {
						const fm = parse(fmMatch[1] ?? '') as Record<string, unknown>
						if (typeof fm.scroll_pos === 'number') {
							scroll[item.id] = fm.scroll_pos
						}
					} catch {
						// Ignore parse error
					}
				}

				notes[item.id] = {
					id: item.id,
					content: body.trim(),
					title: '',
					priority: item.priority,
				}
				priority[item.id] = item.priority
			} else {
				const { noteId, clozeKey } = this.parseItemId(item.id)
				const sidecarPath = `IR/Review Items/${noteId}.md`
				const sidecarContent = await this.fs.read(sidecarPath)
				let start = 0
				let end = 0
				let hint: string | undefined
				if (sidecarContent) {
					const parts = sidecarContent.split('---')
					if (parts.length >= 3) {
						try {
							const parsed = parse(parts[1] ?? '') as SidecarData
							if (parsed.clozes && clozeKey && parsed.clozes[clozeKey]) {
								const c = parsed.clozes[clozeKey]
								if (c) {
									start = c.start ?? 0
									end = c.end ?? 0
									hint = c.hint
								}
							}
						} catch {
							// Ignore parse error
						}
					}
				}

				clozes[item.id] = { id: item.id, noteId: item.noteId, start, end, hint }
				priority[item.id] = item.priority
			}

			const state = await this.dataStore.getState(item.id)
			if (state) {
				states[item.id] = state
				if (state.due) {
					due[item.id] = state.due.toISOString().split('T')[0] ?? ''
				}
			}
		}

		const allFiles = await this.fs.list()
		const logFiles = allFiles
			.filter((f) => f.startsWith('IR/Revlog/') && f.endsWith('.md'))
			.sort()

		const grades: Record<string, unknown>[] = []
		const history: string[] = []
		const again: string[] = []

		for (const logFile of logFiles) {
			const content = await this.fs.read(logFile)
			if (!content) continue
			const lines = content.split('\n').filter(Boolean)
			for (const line of lines) {
				try {
					const record = JSON.parse(line) as { item_id: string; rating: number }
					grades.push({ itemId: record.item_id, rating: record.rating })
					history.push(record.item_id)
					if (record.rating === 1) {
						again.push(record.item_id)
					}
				} catch {
					// Ignore parse error
				}
			}
		}

		return {
			notes,
			clozes,
			states,
			grades,
			again,
			history,
			postponed: this.runtime.postponed as unknown as Record<string, unknown>[],
			dismissed: this.runtime.dismissed,
			priority,
			scroll,
			shown: this.runtime.shown as unknown as Record<string, unknown>[],
			due,
			clock: this.runtime.clock,
			session: { ...this.runtime.session, nextItem: this.runtime.nextItem },
			scheduler: this.runtime.scheduler,
			queue: this.runtime.nextItems.slice(),
			stats: {
				session: {
					poolSize: items.length,
					volatileSize: again.length,
					historySize: history.length,
				},
				queue: {
					total: items.length,
					new: items.filter((i) => {
						const s = states[i.id] as ReviewState | undefined
						return !s || s.status === 'new'
					}).length,
					due: items.filter((i) => {
						const s = states[i.id] as ReviewState | undefined
						return s?.status === 'review' || s?.status === 'learning'
					}).length,
					learning: items.filter((i) => {
						const s = states[i.id] as ReviewState | undefined
						return s?.status === 'learning'
					}).length,
				},
				notes: { count: Object.keys(notes).length },
				clozes: { count: Object.keys(clozes).length },
				grades: { count: grades.length },
				again: { count: again.length },
				due: { count: Object.keys(due).length },
				priority: { count: Object.keys(priority).length },
				scroll: { count: Object.keys(scroll).length },
				dismissed: { count: this.runtime.dismissed.length },
				history: { count: history.length },
				postponed: { count: this.runtime.postponed.length },
				shown: { count: this.runtime.shown.length },
			},
		}
	}

	private parseItemId(itemId: string): { noteId: string; clozeKey?: string } {
		if (itemId.includes('::c')) {
			const [noteId, suffix] = itemId.split('::')
			return { noteId: noteId ?? '', clozeKey: suffix }
		}
		return { noteId: itemId }
	}

	private async updateSidecar(path: string, mutator: (data: SidecarData) => SidecarData) {
		const content = await this.fs.read(path)
		if (!content) return

		const parts = content.split('---')
		if (parts.length >= 3) {
			const yaml = parts[1]
			let parsed = parse(yaml ?? '') as SidecarData
			parsed = mutator(parsed)
			const newYaml = stringify(parsed).trim()
			const newContent = ['---', newYaml, '---', ...parts.slice(2)].join('\n')
			await this.fs.write(path, newContent)
		}
	}
}
