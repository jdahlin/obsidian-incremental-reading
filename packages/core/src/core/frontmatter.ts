import type { CardType, NoteFrontmatter, Status } from './types'

export function normalizeTags(tags: unknown): string[] {
	if (Array.isArray(tags)) {
		return tags.map((tag) => String(tag).trim().replace(/^#/, '')).filter(Boolean)
	}
	if (typeof tags === 'string') {
		return tags
			.split(/[\s,]+/)
			.map((tag) => tag.trim().replace(/^#/, ''))
			.filter(Boolean)
	}
	return []
}

export function normalizeType(value: unknown): CardType {
	return value === 'item' ? 'item' : 'topic'
}

export function normalizeStatus(value: unknown): Status {
	switch (value) {
		case 'learning':
			return 'learning'
		case 'review':
			return 'review'
		case 'relearning':
			return 'relearning'
		default:
			return 'new'
	}
}

export function normalizeNumber(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) return parsed
	}
	return fallback
}

export function parseDate(value: unknown): Date | null {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value
	if (typeof value === 'string' || typeof value === 'number') {
		const parsed = new Date(value)
		if (!Number.isNaN(parsed.getTime())) return parsed
	}
	return null
}

export function formatDate(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	const seconds = String(date.getSeconds()).padStart(2, '0')
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function parseFrontmatter(raw: unknown, extractTag: string): NoteFrontmatter | null {
	if (raw === null || raw === undefined || typeof raw !== 'object') return null
	const data = raw as Record<string, unknown>
	const tags = normalizeTags(data.tags)
	if (extractTag && !tags.includes(extractTag)) return null

	return {
		ir_note_id: typeof data.ir_note_id === 'string' ? data.ir_note_id : '',
		tags,
		source: typeof data.source === 'string' ? data.source : undefined,
		type: normalizeType(data.type),
		created: parseDate(data.created),
		priority: normalizeNumber(data.priority, 50),
	}
}

export function serializeFrontmatter(fm: NoteFrontmatter): Record<string, unknown> {
	const record: Record<string, unknown> = {
		ir_note_id: fm.ir_note_id,
		tags: fm.tags,
		type: fm.type,
		priority: fm.priority,
	}

	if (fm.source !== undefined && fm.source !== '') record.source = fm.source
	if (fm.created !== null && fm.created !== undefined) record.created = formatDate(fm.created)

	return record
}
