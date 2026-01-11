import type { DataStore, NotePlatform, ReviewItem, ReviewRecord, ReviewState } from '../types'
import type { FileSystem } from './FileSystem'
import { load as parse, dump as stringify } from 'js-yaml'

const REVIEW_ITEMS_FOLDER = 'IR/Review Items'
const REVLOG_FOLDER = 'IR/Revlog'

interface ReviewItemFile {
	ir_note_id: string
	note_path: string
	type?: 'topic' | 'item' | 'basic' | 'image_occlusion'
	priority?: number
	cloze?: string[]
	topic?: ReviewState
	basic?: ReviewState
	image_occlusion?: ReviewState
	clozes?: Record<string, ClozeEntry>
}

interface ClozeEntry extends ReviewState {
	cloze_uid: string
}

interface RawItemState {
	status?: string
	due?: string | null
	stability?: number
	difficulty?: number
	reps?: number
	lapses?: number
	last_review?: string | null
}

interface RawClozeEntry extends RawItemState {
	cloze_uid?: string
}

interface RawReviewItemFile {
	ir_note_id?: string
	note_path?: string
	type?: string
	priority?: number
	cloze?: string[]
	topic?: RawItemState
	clozes?: Record<string, RawClozeEntry>
}

export class MarkdownDataStore implements DataStore {
	constructor(
		private fs: FileSystem,
		private notePlatform?: NotePlatform,
	) {}

	async listItems(): Promise<ReviewItem[]> {
		const files = await this.fs.list()
		const itemFiles = files.filter(
			(f) => f.startsWith(`${REVIEW_ITEMS_FOLDER}/`) && f.endsWith('.md'),
		)

		const items: ReviewItem[] = []

		for (const path of itemFiles) {
			const content = await this.fs.read(path)
			if (content === null || content === '') continue

			const data = this.parseReviewItemFile(content)
			if (!data) continue

			// Handle basic cards
			if (data.type === 'basic') {
				items.push({
					id: data.ir_note_id,
					noteId: data.ir_note_id,
					notePath: data.note_path,
					type: 'basic',
					priority: data.priority ?? 50,
					created: new Date(),
				})
			}
			// Handle image occlusion cards (may have multiple cloze regions)
			else if (data.type === 'image_occlusion') {
				if (data.clozes) {
					const notePriority = data.priority ?? 50
					for (const key of Object.keys(data.clozes)) {
						const clozeIndex = Number.parseInt(key.substring(1), 10)
						const clozeId = `${data.ir_note_id}::${key}`
						items.push({
							id: clozeId,
							noteId: data.ir_note_id,
							notePath: data.note_path,
							type: 'image_occlusion',
							clozeIndex: Number.isNaN(clozeIndex) ? null : clozeIndex,
							priority: notePriority,
							created: new Date(),
						})
					}
				} else {
					// Single image occlusion without cloze regions
					items.push({
						id: data.ir_note_id,
						noteId: data.ir_note_id,
						notePath: data.note_path,
						type: 'image_occlusion',
						priority: data.priority ?? 50,
						created: new Date(),
					})
				}
			}
			// Handle topic cards
			else if (data.type === 'topic' || !data.type) {
				items.push({
					id: data.ir_note_id,
					noteId: data.ir_note_id,
					notePath: data.note_path,
					type: 'topic',
					priority: data.priority ?? 50,
					created: new Date(),
				})
			}

			// Handle cloze cards (type: item)
			if (data.clozes && data.type !== 'image_occlusion') {
				const notePriority = data.priority ?? 50
				for (const key of Object.keys(data.clozes)) {
					const clozeIndex = Number.parseInt(key.substring(1), 10)
					const clozeId = `${data.ir_note_id}::${key}`

					items.push({
						id: clozeId,
						noteId: data.ir_note_id,
						notePath: data.note_path,
						type: 'cloze',
						clozeIndex: Number.isNaN(clozeIndex) ? null : clozeIndex,
						priority: notePriority,
						created: new Date(),
					})
				}
			}
		}

		return items
	}

	async getState(itemId: string): Promise<ReviewState | null> {
		const { noteId, clozeKey } = this.parseItemId(itemId)
		const data = await this.readReviewItemFile(noteId)
		if (!data) return null

		if (clozeKey !== undefined) {
			const entry = data.clozes?.[clozeKey]
			if (entry === undefined) return null
			const { cloze_uid: _clozeUid, ...state } = entry
			return state
		} else {
			return data.topic ?? null
		}
	}

	async setState(itemId: string, state: ReviewState): Promise<void> {
		const { noteId, clozeKey } = this.parseItemId(itemId)
		const existing = await this.readReviewItemFile(noteId)
		const data: ReviewItemFile = existing ?? {
			ir_note_id: noteId,
			note_path: '',
		}

		if (clozeKey !== undefined) {
			if (data.clozes === undefined) data.clozes = {}
			const current = data.clozes[clozeKey]
			data.clozes[clozeKey] = {
				...state,
				cloze_uid: current?.cloze_uid ?? this.createId(),
			}
		} else {
			data.topic = state
		}

		await this.writeReviewItemFile(noteId, data)
	}

	async appendReview(record: ReviewRecord): Promise<void> {
		const date = new Date(record.ts)
		const month = String(date.getUTCMonth() + 1).padStart(2, '0')
		const year = date.getUTCFullYear()
		const filename = `${year}-${month}.md`
		const path = `${REVLOG_FOLDER}/${filename}`

		const line = JSON.stringify({
			ts: record.ts,
			item_id: record.itemId,
			rating: record.rating,
			state_before: record.stateBefore,
			stability_before: record.stabilityBefore,
			difficulty_before: record.difficultyBefore,
			elapsed_ms: record.elapsedMs,
		})

		const currentContent = (await this.fs.read(path)) ?? ''
		const newContent = currentContent
			? `${currentContent}
${line}`
			: line
		await this.fs.write(path, newContent)
	}

	async setScrollPos(itemId: string, pos: number): Promise<void> {
		const { noteId } = this.parseItemId(itemId)
		const data = await this.readReviewItemFile(noteId)
		if (data !== null && data.note_path !== '') {
			const noteContent = await this.fs.read(data.note_path)
			if (noteContent !== null && noteContent !== '') {
				const updated = this.updateFrontmatter(noteContent, { scroll_pos: pos })
				await this.fs.write(data.note_path, updated)
			}
		}
	}

	async getScrollPos(itemId: string): Promise<number | null> {
		const { noteId } = this.parseItemId(itemId)
		const data = await this.readReviewItemFile(noteId)
		if (data !== null && data.note_path !== '') {
			const noteContent = await this.fs.read(data.note_path)
			if (noteContent !== null && noteContent !== '') {
				const fm = this.parseFrontmatterBlock(noteContent)
				if (fm !== null) {
					const parsed = parse(fm) as Record<string, unknown>
					return typeof parsed.scroll_pos === 'number' ? parsed.scroll_pos : null
				}
			}
		}
		return null
	}

	private parseItemId(itemId: string): { noteId: string; clozeKey?: string } {
		if (itemId.includes('::c')) {
			const [noteId, suffix] = itemId.split('::')
			return { noteId: noteId ?? '', clozeKey: suffix }
		}
		return { noteId: itemId }
	}

	private getReviewItemPath(noteId: string): string {
		return `${REVIEW_ITEMS_FOLDER}/${noteId}.md`
	}

	private async readReviewItemFile(noteId: string): Promise<ReviewItemFile | null> {
		const path = this.getReviewItemPath(noteId)
		const content = await this.fs.read(path)
		if (content === null || content === '') return null
		return this.parseReviewItemFile(content)
	}

	private async writeReviewItemFile(noteId: string, data: ReviewItemFile): Promise<void> {
		const path = this.getReviewItemPath(noteId)
		const record: Record<string, unknown> = {
			ir_note_id: data.ir_note_id,
			note_path: data.note_path,
		}
		if (data.type) record.type = data.type
		if (data.priority != null) record.priority = data.priority
		if (data.cloze) record.cloze = data.cloze
		if (data.topic) record.topic = this.serializeState(data.topic)
		if (data.clozes) {
			const clozes: Record<string, unknown> = {}
			for (const [key, entry] of Object.entries(data.clozes)) {
				const { cloze_uid, ...rest } = entry
				clozes[key] = {
					cloze_uid,
					...this.serializeState(rest),
				}
			}
			record.clozes = clozes
		}

		const yaml = stringify(record).trim()
		const content = ['---', yaml, '---', ''].join('\n')
		await this.fs.write(path, content)
	}

	private parseReviewItemFile(content: string): ReviewItemFile | null {
		const fm = this.parseFrontmatterBlock(content)
		if (fm === null) return null
		try {
			const parsed = parse(fm) as RawReviewItemFile
			const validTypes = ['topic', 'item', 'basic', 'image_occlusion'] as const
			const parsedType = validTypes.includes(parsed.type as (typeof validTypes)[number])
				? (parsed.type as ReviewItemFile['type'])
				: undefined
			return {
				ir_note_id: parsed.ir_note_id ?? '',
				note_path: parsed.note_path ?? '',
				type: parsedType,
				priority: parsed.priority,
				cloze: parsed.cloze,
				topic: this.parseState(parsed.topic),
				basic: this.parseState((parsed as Record<string, unknown>).basic as RawItemState),
				image_occlusion: this.parseState(
					(parsed as Record<string, unknown>).image_occlusion as RawItemState,
				),
				clozes: this.parseClozes(parsed.clozes),
			}
		} catch (e) {
			console.error('Failed to parse review item file', e)
			return null
		}
	}

	private parseFrontmatterBlock(content: string): string | null {
		const lines = content.split('\n')
		if (lines[0]?.trim() !== '---') return null
		let endIndex = -1
		for (let i = 1; i < lines.length; i++) {
			if (lines[i]?.trim() === '---') {
				endIndex = i
				break
			}
		}
		if (endIndex === -1) return null
		return lines.slice(1, endIndex).join('\n')
	}

	private updateFrontmatter(content: string, updates: Record<string, unknown>): string {
		const fm = this.parseFrontmatterBlock(content)
		let data: Record<string, unknown> = {}
		if (fm !== null) {
			data = parse(fm) as Record<string, unknown>
		}
		const newData = { ...data, ...updates }
		const newYaml = stringify(newData).trim()

		const lines = content.split('\n')
		if (lines[0]?.trim() === '---') {
			let endIndex = -1
			for (let i = 1; i < lines.length; i++) {
				if (lines[i]?.trim() === '---') {
					endIndex = i
					break
				}
			}
			if (endIndex !== -1) {
				return ['---', newYaml, '---', ...lines.slice(endIndex + 1)].join('\n')
			}
		}

		return ['---', newYaml, '---', content].join('\n')
	}

	private parseState(raw?: RawItemState): ReviewState | undefined {
		if (raw === undefined) return undefined
		return {
			status: (raw.status as ReviewState['status']) ?? 'new',
			due: raw.due !== undefined && raw.due !== null ? new Date(raw.due) : null,
			stability: raw.stability ?? 0,
			difficulty: raw.difficulty ?? 0,
			reps: raw.reps ?? 0,
			lapses: raw.lapses ?? 0,
			lastReview:
				raw.last_review !== undefined && raw.last_review !== null
					? new Date(raw.last_review)
					: null,
		}
	}

	private parseClozes(
		raw?: Record<string, RawClozeEntry>,
	): Record<string, ClozeEntry> | undefined {
		if (!raw) return undefined
		const res: Record<string, ClozeEntry> = {}
		for (const k of Object.keys(raw)) {
			const v = raw[k]
			if (!v) continue
			const state = this.parseState(v)
			if (state) {
				res[k] = {
					...state,
					cloze_uid: v.cloze_uid ?? this.createId(),
				}
			}
		}
		return res
	}

	private serializeState(state: ReviewState): Record<string, unknown> {
		const isValidDate = (d: Date | null | undefined): d is Date =>
			d instanceof Date && !Number.isNaN(d.getTime())

		return {
			status: state.status,
			due: isValidDate(state.due) ? state.due.toISOString() : null,
			stability: state.stability,
			difficulty: state.difficulty,
			reps: state.reps,
			lapses: state.lapses,
			last_review: isValidDate(state.lastReview) ? state.lastReview.toISOString() : null,
		}
	}

	private createId(): string {
		return Math.random().toString(36).substring(2, 14)
	}
}
