import type { ItemState } from '@repo/core/core/types'
import type { App } from 'obsidian'
import {
	formatDate,
	normalizeNumber,
	normalizeStatus,
	parseDate,
} from '@repo/core/core/frontmatter'
import { parseYaml, stringifyYaml, TFile } from 'obsidian'
import { createId } from './ids'

const REVIEW_ITEMS_FOLDER = 'IR/Review Items'

export interface ClozeEntry extends ItemState {
	cloze_uid: string
}

export type ReviewItemType = 'topic' | 'item' | 'basic' | 'image_occlusion'

export interface ReviewItemFile {
	ir_note_id: string
	note_path: string
	type?: ReviewItemType
	priority?: number
	cloze?: string[]
	topic?: ItemState
	basic?: ItemState
	image_occlusion?: ItemState
	clozes?: Record<string, ClozeEntry>
}

export async function ensureNoteId(app: App, file: TFile): Promise<string> {
	const cache = app.metadataCache.getFileCache(file)
	const rawFrontmatter = cache?.frontmatter as unknown
	const frontmatter = isRecord(rawFrontmatter) ? rawFrontmatter : undefined
	const existing = frontmatter?.ir_note_id
	if (typeof existing === 'string' && existing.trim()) {
		return existing.trim()
	}

	const noteId = createId()
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm.ir_note_id = noteId
	})
	return noteId
}

export async function readReviewItemFile(app: App, noteId: string): Promise<ReviewItemFile | null> {
	const path = getReviewItemPath(noteId)
	if (!(await app.vault.adapter.exists(path))) return null
	const file = app.vault.getAbstractFileByPath(path)
	const content =
		file instanceof TFile ? await app.vault.read(file) : await app.vault.adapter.read(path)
	const frontmatter = parseFrontmatterBlock(content)
	if (frontmatter === null) return null
	const parsed = parseYaml(frontmatter) as unknown
	if (parsed === null || parsed === undefined || typeof parsed !== 'object') return null
	const raw = parsed as Record<string, unknown>

	const ir_note_id = typeof raw.ir_note_id === 'string' ? raw.ir_note_id : noteId
	const note_path = typeof raw.note_path === 'string' ? raw.note_path : ''
	const type = parseReviewItemType(raw.type)
	const priority = normalizeNumber(raw.priority, 50)
	const cloze = Array.isArray(raw.cloze) ? raw.cloze.map((value) => String(value)) : undefined
	const topic = parseItemState(isRecord(raw.topic) ? raw.topic : undefined)
	const basic = parseItemState(isRecord(raw.basic) ? raw.basic : undefined)
	const image_occlusion = parseItemState(
		isRecord(raw.image_occlusion) ? raw.image_occlusion : undefined,
	)
	const clozes = parseClozes(isRecord(raw.clozes) ? raw.clozes : undefined)

	return {
		ir_note_id,
		note_path,
		type,
		priority,
		cloze,
		topic: topic ?? undefined,
		basic: basic ?? undefined,
		image_occlusion: image_occlusion ?? undefined,
		clozes: clozes ?? undefined,
	}
}

function parseReviewItemType(value: unknown): ReviewItemType | undefined {
	if (value === 'topic' || value === 'item' || value === 'basic' || value === 'image_occlusion') {
		return value
	}
	return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return (
		value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
	)
}

export async function writeReviewItemFile(
	app: App,
	noteId: string,
	data: ReviewItemFile,
): Promise<void> {
	await ensureReviewItemsFolder(app)
	const path = getReviewItemPath(noteId)

	const record: Record<string, unknown> = {
		ir_note_id: data.ir_note_id,
		note_path: data.note_path,
	}

	if (data.type) record.type = data.type
	if (data.priority != null) record.priority = data.priority
	if (data.cloze && data.cloze.length) record.cloze = data.cloze

	if (data.topic) {
		record.topic = serializeItemState(data.topic)
	}

	if (data.basic) {
		record.basic = serializeItemState(data.basic)
	}

	if (data.image_occlusion) {
		record.image_occlusion = serializeItemState(data.image_occlusion)
	}

	if (data.clozes && Object.keys(data.clozes).length) {
		const clozes: Record<string, unknown> = {}
		for (const [key, entry] of Object.entries(data.clozes)) {
			clozes[key] = {
				cloze_uid: entry.cloze_uid,
				...serializeItemState(entry),
			}
		}
		record.clozes = clozes
	}

	const yaml = stringifyYaml(record).trim()
	const content = ['---', yaml, '---', ''].join('\n')

	const existing = app.vault.getAbstractFileByPath(path)
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content)
		return
	}

	// Race condition: file may be created between check and create
	try {
		await app.vault.create(path, content)
	} catch {
		// File was created by another operation - modify instead
		const file = app.vault.getAbstractFileByPath(path)
		if (file instanceof TFile) {
			await app.vault.modify(file, content)
		}
	}
}

export async function deleteReviewItemFile(app: App, noteId: string): Promise<void> {
	const path = getReviewItemPath(noteId)
	const file = app.vault.getAbstractFileByPath(path)
	if (file instanceof TFile) {
		await app.fileManager.trashFile(file)
		return
	}
	if (await app.vault.adapter.exists(path)) {
		await app.vault.adapter.remove(path)
	}
}

export function getReviewItemPath(noteId: string): string {
	return `${REVIEW_ITEMS_FOLDER}/${noteId}.md`
}

async function ensureReviewItemsFolder(app: App): Promise<void> {
	// Ensure parent folder exists first
	const parent = app.vault.getAbstractFileByPath('IR')
	if (!parent) {
		try {
			await app.vault.createFolder('IR')
		} catch {
			// Already created by another operation
		}
	}
	// Then ensure review items folder
	const folder = app.vault.getAbstractFileByPath(REVIEW_ITEMS_FOLDER)
	if (!folder) {
		try {
			await app.vault.createFolder(REVIEW_ITEMS_FOLDER)
		} catch {
			// Already created by another operation
		}
	}
}

function parseFrontmatterBlock(content: string): string | null {
	const lines = content.split('\n')
	const firstLine = lines[0]
	if (firstLine === undefined || firstLine.trim() !== '---') return null
	let endIndex = -1
	for (let i = 1; i < lines.length; i += 1) {
		const line = lines[i]
		if (line !== undefined && line.trim() === '---') {
			endIndex = i
			break
		}
	}
	if (endIndex === -1) return null
	return lines.slice(1, endIndex).join('\n')
}

function parseItemState(raw: Record<string, unknown> | undefined): ItemState | null {
	if (raw === undefined || typeof raw !== 'object') return null
	return {
		status: normalizeStatus(raw.status),
		due: parseDate(raw.due),
		stability: normalizeNumber(raw.stability, 0),
		difficulty: normalizeNumber(raw.difficulty, 0),
		reps: normalizeNumber(raw.reps, 0),
		lapses: normalizeNumber(raw.lapses, 0),
		last_review: parseDate(raw.last_review),
	}
}

function parseClozes(raw: Record<string, unknown> | undefined): Record<string, ClozeEntry> | null {
	if (raw === undefined || typeof raw !== 'object') return null
	const result: Record<string, ClozeEntry> = {}
	for (const [key, value] of Object.entries(raw)) {
		if (value === null || value === undefined || typeof value !== 'object') continue
		const entry = value as Record<string, unknown>
		const state = parseItemState(entry)
		const cloze_uid = typeof entry.cloze_uid === 'string' ? entry.cloze_uid : ''
		if (!state) continue
		result[key] = {
			cloze_uid: cloze_uid || createId(),
			...state,
		}
	}
	return result
}

function serializeItemState(state: ItemState): Record<string, unknown> {
	const record: Record<string, unknown> = {
		status: state.status,
		stability: state.stability,
		difficulty: state.difficulty,
		reps: state.reps,
		lapses: state.lapses,
	}

	if (state.due) record.due = formatDate(state.due)
	if (state.last_review) record.last_review = formatDate(state.last_review)

	return record
}
