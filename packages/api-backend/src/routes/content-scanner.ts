import type { Hono } from 'hono'

import type { Pool } from 'pg'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

interface CourseMeta {
	name: string
	code: string
}

const COURSE_META: Record<string, CourseMeta> = {
	fysiologi_1: { name: 'Fysiologi 1 - Neurofysiologi', code: 'LPG002' },
	fysiologi_2: { name: 'Fysiologi 2 - Cirkulation & Respiration', code: 'LPG002' },
	fysiologi_3: { name: 'Fysiologi 3 - Digestion & Reproduktion', code: 'LPG002' },
}

const COURSE_TAG_MAP: Record<string, string> = {
	fysiologi_1: 'fysiologi',
	fysiologi_2: 'fysiologi',
	fysiologi_3: 'fysiologi',
}

const SEARCH_SQL = `
WITH q AS (
	SELECT websearch_to_tsquery('swedish', $1) AS q_sv,
				 websearch_to_tsquery('english', $1) AS q_en
),
matches AS (
	SELECT DISTINCT ON (r.id, rp.page_number)
			r.id, rp.page_number, r.name AS filename, op.content,
			(ts_rank_cd(op.tsv_sv, q.q_sv) + ts_rank_cd(op.tsv_en, q.q_en))::float AS rank,
			q.q_sv
	FROM q, ocr_page op
	JOIN ocr_attempt oa ON oa.id = op.ocr_attempt_id AND oa.selected
	JOIN resource r ON r.id = oa.resource_id
	JOIN resource_page rp ON rp.id = op.resource_page_id
	WHERE op.tsv_sv @@ q.q_sv OR op.tsv_en @@ q.q_en
	ORDER BY r.id, rp.page_number, rank DESC
)
SELECT m.id, m.page_number, m.filename, m.rank,
	ts_headline('swedish', m.content, m.q_sv, 'MaxWords=30,MinWords=15') AS snippet,
	array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM matches m
LEFT JOIN resource_tag rt ON rt.resource_id = m.id
LEFT JOIN tag t ON t.id = rt.tag_id
GROUP BY m.id, m.page_number, m.filename, m.rank, m.content, m.q_sv
ORDER BY m.rank DESC
LIMIT $2;
`

const RESOURCES_SQL = `
SELECT r.id, r.name, r.mime_type,
	(SELECT COUNT(*) FROM resource_page WHERE resource_id = r.id) AS page_count,
	array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM resource r
LEFT JOIN resource_tag rt ON rt.resource_id = r.id
LEFT JOIN tag t ON t.id = rt.tag_id
GROUP BY r.id
ORDER BY r.name
LIMIT $1 OFFSET $2;
`

const RESOURCES_BY_TAG_SQL = `
SELECT r.id, r.name, r.mime_type,
	(SELECT COUNT(*) FROM resource_page WHERE resource_id = r.id) AS page_count,
	array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM resource r
JOIN resource_tag rt ON rt.resource_id = r.id
JOIN tag t ON t.id = rt.tag_id
WHERE t.name = $1
GROUP BY r.id
ORDER BY r.name
LIMIT $2 OFFSET $3;
`

const RESOURCES_COUNT_SQL = `SELECT COUNT(*) AS total FROM resource;`

const RESOURCES_COUNT_BY_TAG_SQL = `
SELECT COUNT(DISTINCT r.id) AS total
FROM resource r
JOIN resource_tag rt ON rt.resource_id = r.id
JOIN tag t ON t.id = rt.tag_id
WHERE t.name = $1;
`

interface CalendarEntry {
	forelasningar?: Array<{ title: string; date: string; start: string; end: string }>
	labbar?: Array<{ title: string; date: string; start: string; end: string }>
	tentamen?: Array<{ title: string; date: string; start: string; end: string; note?: string }>
}

export type CalendarData = Record<string, CalendarEntry>

export interface ContentScannerDeps {
	getCalendar: () => Promise<CalendarData>
	getPool: () => Pool | null
}

function calcDuration(start: string, end: string): string {
	const parseTime = (value: string): number | null => {
		const [hourPart, minutePart] = value.split(':')
		const hour = Number(hourPart)
		const minute = Number(minutePart)
		if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
			return null
		}
		return hour * 60 + minute
	}

	const startMinutes = parseTime(start)
	const endMinutes = parseTime(end)
	if (startMinutes === null || endMinutes === null) {
		return '0 min'
	}
	const totalMinutes = endMinutes - startMinutes
	if (totalMinutes >= 60) {
		const hours = Math.floor(totalMinutes / 60)
		const remaining = totalMinutes % 60
		if (remaining > 0) {
			return `${hours}h ${remaining}min`
		}
		return `${hours}h`
	}
	return `${totalMinutes} min`
}

function inferContentType(filename: string, tags: readonly string[]): string {
	const lower = filename.toLowerCase()
	const tagSet = new Set(tags.map((tag) => tag.toLowerCase()))
	if (
		lower.includes('exam') ||
		lower.includes('tenta') ||
		lower.includes('prov') ||
		tagSet.has('kandidaterna')
	) {
		return 'exam'
	}
	if (lower.includes('lecture') || lower.includes('föreläsning') || lower.includes('slides')) {
		return 'lecture'
	}
	if (lower.includes('note') || lower.includes('anteckning')) {
		return 'notes'
	}
	if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
		return 'video'
	}
	return 'book'
}

interface ResourceRow {
	id: number
	name: string
	page_count: number
	tags: string[] | null
}

interface SearchRow {
	id: number
	page_number: number
	filename: string
	rank: number
	snippet: string | null
	tags: string[] | null
}

function requirePool(deps: Readonly<ContentScannerDeps>): Pool {
	const pool = deps.getPool()
	if (!pool) {
		throw new Error('Missing CONTENT_SCANNER_DSN')
	}
	return pool
}

export function createContentScannerRoutes(app: Hono, deps: Readonly<ContentScannerDeps>): void {
	app.get('/api/courses', async (c) => {
		const calendar = await deps.getCalendar()
		const courses = Object.entries(calendar).map(([courseId, data]) => {
			const meta = COURSE_META[courseId] ?? { name: courseId, code: '' }
			return {
				id: courseId,
				name: meta.name,
				code: meta.code,
				lecture_count: data.forelasningar?.length ?? 0,
				lab_count: data.labbar?.length ?? 0,
				exam_count: data.tentamen?.length ?? 0,
			}
		})

		return c.json({ courses })
	})

	app.get('/api/courses/:courseId/lectures', async (c) => {
		const courseId = c.req.param('courseId')
		const calendar = await deps.getCalendar()
		const entry = calendar[courseId]
		if (!entry) {
			return c.json({ course_id: courseId, lectures: [] })
		}

		const lectures = (entry.forelasningar ?? []).map((lecture, index) => ({
			id: `${courseId}-lec-${index + 1}`,
			number: index + 1,
			title: lecture.title,
			date: lecture.date,
			start: lecture.start,
			end: lecture.end,
			duration: calcDuration(lecture.start, lecture.end),
			content_count: 0,
			is_completed: false,
		}))

		return c.json({ course_id: courseId, lectures })
	})

	app.get('/api/courses/:courseId/labs', async (c) => {
		const courseId = c.req.param('courseId')
		const calendar = await deps.getCalendar()
		const entry = calendar[courseId]
		if (!entry) {
			return c.json({ course_id: courseId, labs: [] })
		}

		const labs = (entry.labbar ?? []).map((lab, index) => ({
			id: `${courseId}-lab-${index + 1}`,
			number: index + 1,
			title: lab.title,
			date: lab.date,
			start: lab.start,
			end: lab.end,
			duration: calcDuration(lab.start, lab.end),
		}))

		return c.json({ course_id: courseId, labs })
	})

	app.get('/api/courses/:courseId/exams', async (c) => {
		const courseId = c.req.param('courseId')
		const calendar = await deps.getCalendar()
		const entry = calendar[courseId]
		if (!entry) {
			return c.json({ course_id: courseId, exams: [] })
		}

		const exams = (entry.tentamen ?? []).map((exam, index) => ({
			id: `${courseId}-exam-${index + 1}`,
			number: index + 1,
			title: exam.title,
			date: exam.date,
			start: exam.start,
			end: exam.end,
			duration: calcDuration(exam.start, exam.end),
			note: exam.note ?? null,
		}))

		return c.json({ course_id: courseId, exams })
	})

	app.get(
		'/api/content',
		zValidator(
			'query',
			z.object({
				limit: z.coerce.number().min(1).max(200).optional(),
				offset: z.coerce.number().min(0).optional(),
				tag: z.string().optional(),
				course_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { limit = 50, offset = 0, tag, course_id: courseId } = c.req.valid('query')
			const filterTag = tag ?? (courseId ? COURSE_TAG_MAP[courseId] : undefined)
			const pool = requirePool(deps)

			const client = await pool.connect()
			try {
				let total = 0
				let rows: ResourceRow[] = []

				if (filterTag) {
					const countResult = await client.query<{ total: number }>(
						RESOURCES_COUNT_BY_TAG_SQL,
						[filterTag],
					)
					total = Number(countResult.rows[0]?.total ?? 0)
					const result = await client.query<ResourceRow>(RESOURCES_BY_TAG_SQL, [
						filterTag,
						limit,
						offset,
					])
					rows = result.rows
				} else {
					const countResult = await client.query<{ total: number }>(RESOURCES_COUNT_SQL)
					total = Number(countResult.rows[0]?.total ?? 0)
					const result = await client.query<ResourceRow>(RESOURCES_SQL, [limit, offset])
					rows = result.rows
				}

				const items = rows.map((row) => {
					const tags = row.tags ?? []
					return {
						id: String(row.id),
						title: row.name,
						type: inferContentType(row.name, tags),
						description: `Resource: ${row.name}`,
						lecture_id: null,
						page_count: row.page_count,
						duration: null,
						author: null,
						tags,
					}
				})

				return c.json({ items, total })
			} finally {
				client.release()
			}
		},
	)

	app.get(
		'/api/courses/:courseId/materials',
		zValidator('query', z.object({ limit: z.coerce.number().min(1).max(200).optional() })),
		async (c) => {
			const courseId = c.req.param('courseId')
			const { limit = 50 } = c.req.valid('query')
			const filterTag = COURSE_TAG_MAP[courseId]
			if (!filterTag) {
				return c.json({ course_id: courseId, materials: [], total: 0 })
			}

			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const result = await client.query<ResourceRow>(RESOURCES_BY_TAG_SQL, [
					filterTag,
					limit,
					0,
				])
				const materials = result.rows.map((row) => {
					const tags = row.tags ?? []
					return {
						id: String(row.id),
						title: row.name,
						type: inferContentType(row.name, tags),
						page_count: row.page_count,
						tags,
					}
				})
				return c.json({ course_id: courseId, materials, total: materials.length })
			} finally {
				client.release()
			}
		},
	)

	app.get(
		'/api/search',
		zValidator(
			'query',
			z.object({
				q: z.string().min(2),
				limit: z.coerce.number().min(1).max(100).optional(),
			}),
		),
		async (c) => {
			const { q, limit = 20 } = c.req.valid('query')
			const pool = requirePool(deps)

			const client = await pool.connect()
			try {
				const result = await client.query<SearchRow>(SEARCH_SQL, [q, limit])
				const results = result.rows.map((hit) => {
					const tags = hit.tags ?? []
					return {
						resource_id: hit.id,
						title: hit.filename,
						type: inferContentType(hit.filename, tags),
						page_number: hit.page_number,
						rank: hit.rank,
						snippet: hit.snippet ?? '',
						tags,
					}
				})
				return c.json({ query: q, results, total: results.length })
			} finally {
				client.release()
			}
		},
	)
}
