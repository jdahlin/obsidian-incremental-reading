import type { Hono } from 'hono'
import type { Pool } from 'pg'

import { readdir, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { zValidator } from '@hono/zod-validator'
import * as ical from 'node-ical'
import { z } from 'zod'
import { buildInsertStatement, buildUpdateStatement, mapRowDates } from '../db/crud'

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

const COURSE_KIND_VALUES = ['lecture', 'group', 'lab', 'seminarium', 'examination'] as const
const CONTENT_TYPE_VALUES = ['book', 'video', 'notes', 'exam', 'lecture'] as const
const KANDIDATERNA_ROOT = resolve(process.cwd(), 'packages', 'kandidaterna-scraper', 'scraped_data')
const CANVAS_ROOT = resolve(process.cwd(), 'packages', 'canvas-extractor', 'canvas-lms')

const courseInputSchema = z.object({
	name: z.string().min(1),
	code: z.string().min(1).optional().nullable(),
	description: z.string().min(1).optional().nullable(),
	metadata: z
		.object({
			canvas_url: z.string().url().optional(),
			kandidaterna_course_id: z.string().min(1).optional(),
			timedit_ical_url: z.string().url().optional(),
		})
		.passthrough()
		.optional(),
})

const courseUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		code: z.string().min(1).optional().nullable(),
		description: z.string().min(1).optional().nullable(),
	})
	.refine((data) => Object.values(data).some((value) => value !== undefined), {
		message: 'No fields to update',
	})

const courseListQuerySchema = z.object({
	q: z.string().min(1).optional(),
	include_hidden: z.coerce.boolean().optional(),
})

const courseItemInputSchema = z.object({
	course_id: z.coerce.number(),
	name: z.string().min(1),
	description: z.string().min(1).optional().nullable(),
	lecturer: z.string().min(1).optional().nullable(),
	tags: z.array(z.string()).optional(),
	start_at: z.string().min(1).optional().nullable(),
	end_at: z.string().min(1).optional().nullable(),
	kind: z.enum(COURSE_KIND_VALUES),
	is_hidden: z.boolean().optional(),
})

const courseItemUpdateSchema = courseItemInputSchema
	.partial()
	.refine((data) => Object.values(data).some((value) => value !== undefined), {
		message: 'No fields to update',
	})

const courseItemListQuerySchema = z.object({
	course_id: z.coerce.number().optional(),
	kind: z.enum(COURSE_KIND_VALUES).optional(),
	q: z.string().min(1).optional(),
	include_hidden: z.coerce.boolean().optional(),
})

const resourceAssignSchema = z.object({
	course_item_id: z.coerce.number().nullable(),
})

const courseIdParamSchema = z.object({
	courseId: z.coerce.number(),
})

const courseItemIdParamSchema = z.object({
	itemId: z.coerce.number(),
})

const resourceIdParamSchema = z.object({
	resourceId: z.coerce.number(),
})

const SEARCH_SQL = `
WITH q AS (
	SELECT websearch_to_tsquery('swedish', $1) AS q_sv,
				 websearch_to_tsquery('english', $1) AS q_en
),
matches AS (
	SELECT DISTINCT ON (s.resource_id, s.page_number)
			s.resource_id,
			s.page_number,
			s.filename,
			s.content,
			(ts_rank_cd(s.tsv_sv, q.q_sv) + ts_rank_cd(s.tsv_en, q.q_en))::float AS rank,
			q.q_sv,
			s.tags,
			s.course_item_id
	FROM q, search_index_view s
	WHERE s.tsv_sv @@ q.q_sv OR s.tsv_en @@ q.q_en
	ORDER BY s.resource_id, s.page_number, rank DESC
)
SELECT m.resource_id AS id,
	m.page_number,
	m.filename,
	m.rank,
	m.course_item_id,
	ts_headline('swedish', m.content, m.q_sv, 'MaxWords=30,MinWords=15') AS snippet,
	m.tags
FROM matches m
ORDER BY m.rank DESC
LIMIT $2;
`

const RESOURCES_SQL = `
SELECT id, name, mime_type, course_item_id, page_count, tags
FROM resource_with_tags_view
ORDER BY name
LIMIT $1 OFFSET $2;
`

const RESOURCES_BY_TAG_SQL = `
SELECT id, name, mime_type, course_item_id, page_count, tags
FROM resource_with_tags_view
WHERE $1 = ANY(tags)
ORDER BY name
LIMIT $2 OFFSET $3;
`

const RESOURCES_COUNT_SQL = `SELECT COUNT(*) AS total FROM resource;`

const RESOURCES_COUNT_BY_TAG_SQL = `
SELECT COUNT(*) AS total
FROM resource_with_tags_view
WHERE $1 = ANY(tags);
`

const RESOURCES_BY_COURSE_SQL = `
SELECT id, name, mime_type, course_item_id, page_count, tags
FROM resource_with_tags_view
WHERE course_id = $1
ORDER BY name
LIMIT $2 OFFSET $3;
`

const RESOURCES_COUNT_BY_COURSE_SQL = `SELECT COUNT(*) AS total FROM resource WHERE course_id = $1;`

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
	course_item_id: number | null
}

interface SearchRow {
	id: number
	page_number: number
	filename: string
	rank: number
	snippet: string | null
	tags: string[] | null
	course_item_id: number | null
}

interface CourseRow {
	id: number
	name: string
	code: string | null
	description: string | null
	metadata: Record<string, unknown> | null
	created_at: Date
	updated_at: Date
	lecture_count: number
	lab_count: number
	exam_count: number
	group_count: number
	seminarium_count: number
}

interface CourseItemRow {
	id: number
	course_id: number
	created_at: Date
	modified_at: Date
	name: string
	description: string | null
	lecturer: string | null
	tags: string[]
	start_at: Date | null
	end_at: Date | null
	kind: (typeof COURSE_KIND_VALUES)[number]
	is_hidden: boolean
}

interface LectureRow {
	id: number
	name: string
	start_date: string | null
	start_time: string | null
	end_time: string | null
	content_count: number
	number: number
}

interface LabRow {
	id: number
	name: string
	start_date: string | null
	start_time: string | null
	end_time: string | null
	number: number
}

interface ResourceAssignRow {
	id: number
	course_id: number | null
	course_item_id: number | null
	updated_at: Date
}

interface TimeditEvent {
	type?: unknown
	start?: unknown
	end?: unknown
	summary?: unknown
	description?: unknown
	location?: unknown
	categories?: unknown
}

function requirePool(deps: Readonly<ContentScannerDeps>): Pool {
	const pool = deps.getPool()
	if (!pool) {
		throw new Error('Missing CONTENT_SCANNER_DSN')
	}
	return pool
}

function buildCoursesQuery(params: Readonly<{ q?: string; includeHidden: boolean }>): {
	sql: string
	params: unknown[]
} {
	const values: unknown[] = []
	const filters: string[] = []
	if (params.q) {
		values.push(`%${params.q}%`)
		filters.push(`(c.name ILIKE $${values.length} OR c.code ILIKE $${values.length})`)
	}
	const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
	const lectureCount = params.includeHidden ? 'lecture_count_all' : 'lecture_count_visible'
	const labCount = params.includeHidden ? 'lab_count_all' : 'lab_count_visible'
	const examCount = params.includeHidden ? 'exam_count_all' : 'exam_count_visible'
	const groupCount = params.includeHidden ? 'group_count_all' : 'group_count_visible'
	const seminariumCount = params.includeHidden
		? 'seminarium_count_all'
		: 'seminarium_count_visible'

	return {
		sql: `
SELECT c.id, c.name, c.code, c.description, c.metadata, c.created_at, c.updated_at,
	c.${lectureCount} AS lecture_count,
	c.${labCount} AS lab_count,
	c.${examCount} AS exam_count,
	c.${groupCount} AS group_count,
	c.${seminariumCount} AS seminarium_count
FROM course_counts_view c
${whereSql}
ORDER BY c.name;
`,
		params: values,
	}
}

function buildCourseItemListQuery(
	params: Readonly<{
		courseId?: number
		kind?: (typeof COURSE_KIND_VALUES)[number]
		q?: string
		includeHidden: boolean
	}>,
): { sql: string; params: unknown[] } {
	const values: unknown[] = []
	const filters: string[] = []

	if (params.courseId !== undefined) {
		values.push(params.courseId)
		filters.push(`course_id = $${values.length}`)
	}
	if (params.kind !== undefined) {
		values.push(params.kind)
		filters.push(`kind = $${values.length}`)
	}
	if (params.q) {
		values.push(`%${params.q}%`)
		filters.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`)
	}
	if (!params.includeHidden) {
		filters.push('is_hidden = FALSE')
	}

	const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
	return {
		sql: `
SELECT id, course_id, created_at, modified_at, name, description, lecturer, tags, start_at, end_at, kind, is_hidden
FROM course_item
${whereSql}
ORDER BY start_at NULLS LAST, id;
`,
		params: values,
	}
}

function serializeCourseRow(row: CourseRow): Record<string, unknown> {
	mapRowDates(row, ['created_at', 'updated_at'])
	return {
		id: String(row.id),
		name: row.name,
		code: row.code ?? '',
		description: row.description,
		metadata: row.metadata ?? {},
		created_at: row.created_at,
		updated_at: row.updated_at,
		lecture_count: row.lecture_count,
		lab_count: row.lab_count,
		exam_count: row.exam_count,
		group_count: row.group_count,
		seminarium_count: row.seminarium_count,
	}
}

function serializeCourseItemRow(row: CourseItemRow): Record<string, unknown> {
	mapRowDates(row, ['created_at', 'modified_at', 'start_at', 'end_at'])
	return {
		id: String(row.id),
		course_id: row.course_id,
		created_at: row.created_at,
		modified_at: row.modified_at,
		name: row.name,
		description: row.description,
		lecturer: row.lecturer,
		tags: row.tags ?? [],
		start_at: row.start_at,
		end_at: row.end_at,
		kind: row.kind,
		is_hidden: row.is_hidden,
	}
}

function parseNumericId(value: Readonly<string>): number | null {
	const id = Number(value)
	return Number.isFinite(id) ? id : null
}

async function listDirectories(root: Readonly<string>): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true })
	return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function readJsonFile<T>(path: Readonly<string>): Promise<T | null> {
	try {
		const raw = await readFile(path, 'utf8')
		return JSON.parse(raw) as T
	} catch {
		return null
	}
}

async function countFiles(root: Readonly<string>): Promise<number> {
	try {
		const entries = await readdir(root, { withFileTypes: true })
		return entries.filter((entry) => entry.isFile()).length
	} catch {
		return 0
	}
}

async function resolveCanvasCoursePath(
	courseId: Readonly<string>,
): Promise<{ id: string; path: string } | null> {
	const entries = await listDirectories(CANVAS_ROOT)
	for (const entry of entries) {
		if (entry.startsWith('_')) {
			continue
		}
		const coursePath = join(CANVAS_ROOT, entry)
		if (entry === courseId) {
			return { id: entry, path: coursePath }
		}
		const info = await readJsonFile<{ id?: number }>(join(coursePath, '_course_info.json'))
		if (info?.id !== undefined && String(info.id) === courseId) {
			return { id: String(info.id), path: coursePath }
		}
	}
	return null
}

function inferCourseItemKindFromSummary(
	summary: Readonly<string>,
): (typeof COURSE_KIND_VALUES)[number] {
	const lower = summary.toLowerCase()
	if (lower.includes('exam') || lower.includes('tenta') || lower.includes('tentamen')) {
		return 'examination'
	}
	if (lower.includes('seminar') || lower.includes('seminarium')) {
		return 'seminarium'
	}
	if (lower.includes('lab')) {
		return 'lab'
	}
	if (lower.includes('group') || lower.includes('grupp')) {
		return 'group'
	}
	return 'lecture'
}

function normalizeTimeditDescription(
	description: Readonly<string | undefined>,
	location: Readonly<string | undefined>,
): string | null {
	const parts = [description, location].filter((value) => value && value.trim().length > 0)
	if (parts.length === 0) {
		return null
	}
	return parts.join('\n')
}

function buildLecturesSql(includeHidden: boolean): string {
	const source = includeHidden ? 'lecture_items_view' : 'lecture_items_visible_view'
	return `
SELECT id, name, start_date, start_time, end_time, content_count, number
FROM ${source}
WHERE course_id = $1
ORDER BY start_at NULLS LAST, id;
`
}

function buildLabsSql(includeHidden: boolean): string {
	const source = includeHidden ? 'lab_items_view' : 'lab_items_visible_view'
	return `
SELECT id, name, start_date, start_time, end_time, number
FROM ${source}
WHERE course_id = $1
ORDER BY start_at NULLS LAST, id;
`
}

export function createContentScannerRoutes(app: Hono, deps: Readonly<ContentScannerDeps>): void {
	app.get('/api/courses', zValidator('query', courseListQuerySchema), async (c) => {
		const { q, include_hidden } = c.req.valid('query')
		const pool = deps.getPool()
		if (!pool) {
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
		}

		const client = await pool.connect()
		try {
			const { sql, params } = buildCoursesQuery({
				q,
				includeHidden: include_hidden ?? false,
			})
			const result = await client.query<CourseRow>(sql, params)
			const courses = result.rows.map((row) => serializeCourseRow(row))
			return c.json({ courses })
		} finally {
			client.release()
		}
	})

	app.post('/api/courses', zValidator('json', courseInputSchema), async (c) => {
		const pool = requirePool(deps)
		const body = c.req.valid('json')
		const insertData = {
			name: body.name,
			code: body.code ?? null,
			description: body.description ?? null,
			metadata: body.metadata ?? {},
		}
		const { sql, params } = buildInsertStatement(
			'course',
			insertData,
			['name', 'code', 'description', 'metadata'],
			['id', 'name', 'code', 'description', 'metadata', 'created_at', 'updated_at'],
		)

		const client = await pool.connect()
		try {
			const result = await client.query<CourseRow>(sql, params)
			const row = result.rows[0]
			if (!row) {
				return c.json({ error: 'Failed to create course' }, 500)
			}
			return c.json({ course: serializeCourseRow(row) })
		} finally {
			client.release()
		}
	})

	app.get('/api/courses/:courseId', zValidator('param', courseIdParamSchema), async (c) => {
		const { courseId } = c.req.valid('param')
		const pool = requirePool(deps)

		const client = await pool.connect()
		try {
			const result = await client.query<CourseRow>(
				`
SELECT c.id, c.name, c.code, c.description, c.metadata, c.created_at, c.updated_at,
	c.lecture_count_visible AS lecture_count,
	c.lab_count_visible AS lab_count,
	c.exam_count_visible AS exam_count,
	c.group_count_visible AS group_count,
	c.seminarium_count_visible AS seminarium_count
FROM course_counts_view c
WHERE c.id = $1;
`,
				[courseId],
			)
			const row = result.rows[0]
			if (!row) {
				return c.json({ error: 'Course not found' }, 404)
			}
			return c.json({ course: serializeCourseRow(row) })
		} finally {
			client.release()
		}
	})

	app.put(
		'/api/courses/:courseId',
		zValidator('param', courseIdParamSchema),
		zValidator('json', courseUpdateSchema),
		async (c) => {
			const { courseId } = c.req.valid('param')
			const body = c.req.valid('json')
			const pool = requirePool(deps)
			const { sql, params } = buildUpdateStatement(
				'course',
				'id',
				courseId,
				{
					name: body.name,
					code: body.code,
					description: body.description,
				},
				['name', 'code', 'description'],
				['id', 'name', 'code', 'description', 'metadata', 'created_at', 'updated_at'],
				'updated_at',
			)

			const client = await pool.connect()
			try {
				const result = await client.query<CourseRow>(sql, params)
				const row = result.rows[0]
				if (!row) {
					return c.json({ error: 'Course not found' }, 404)
				}
				return c.json({ course: serializeCourseRow(row) })
			} finally {
				client.release()
			}
		},
	)

	app.delete('/api/courses/:courseId', zValidator('param', courseIdParamSchema), async (c) => {
		const { courseId } = c.req.valid('param')
		const pool = requirePool(deps)
		const client = await pool.connect()
		try {
			const result = await client.query<{ id: number }>(
				'DELETE FROM course WHERE id = $1 RETURNING id;',
				[courseId],
			)
			if (!result.rows[0]) {
				return c.json({ error: 'Course not found' }, 404)
			}
			return c.json({ success: true })
		} finally {
			client.release()
		}
	})

	app.post(
		'/api/courses/:courseId/import/timedit',
		zValidator('param', courseIdParamSchema),
		async (c) => {
			const { courseId } = c.req.valid('param')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const courseResult = await client.query<{
					metadata: Record<string, unknown> | null
				}>('SELECT metadata FROM course WHERE id = $1;', [courseId])
				const metadata = courseResult.rows[0]?.metadata ?? {}
				const timeditUrl = (metadata as { timedit_ical_url?: unknown }).timedit_ical_url
				if (typeof timeditUrl !== 'string' || timeditUrl.length === 0) {
					return c.json({ error: 'Course is missing timedit_ical_url metadata' }, 400)
				}

				const response = await fetch(timeditUrl)
				if (!response.ok) {
					return c.json(
						{ error: `Failed to fetch Timedit iCal (${response.status})` },
						502,
					)
				}
				const icsText = await response.text()
				const parsed = ical.parseICS(icsText) as Record<string, unknown>
				const events = Object.values(parsed).filter(
					(entry): entry is TimeditEvent =>
						typeof entry === 'object' && entry !== null && 'type' in entry,
				)

				const existingResult = await client.query<{ name: string; start_at: Date | null }>(
					'SELECT name, start_at FROM course_item WHERE course_id = $1;',
					[courseId],
				)
				const existingKeys = new Set(
					existingResult.rows.map(
						(row) => `${row.name}::${row.start_at?.toISOString() ?? ''}`,
					),
				)

				let createdCount = 0
				for (const event of events) {
					const eventType = event.type
					const start = event.start
					const end = event.end
					if (eventType !== 'VEVENT' || !(start instanceof Date)) {
						continue
					}
					const summary = event.summary
					const name = typeof summary === 'string' ? summary.trim() : ''
					if (!name) {
						continue
					}

					const startAt = start
					const endAt = end instanceof Date ? end : null
					const key = `${name}::${startAt.toISOString()}`
					if (existingKeys.has(key)) {
						continue
					}

					const categories = event.categories
					const tags = Array.isArray(categories)
						? categories.filter((value): value is string => typeof value === 'string')
						: typeof categories === 'string'
							? [categories]
							: []

					const descriptionValue =
						typeof event.description === 'string' ? event.description : undefined
					const locationValue =
						typeof event.location === 'string' ? event.location : undefined
					const description = normalizeTimeditDescription(descriptionValue, locationValue)
					const kind = inferCourseItemKindFromSummary(name)

					const insert = buildInsertStatement(
						'course_item',
						{
							course_id: courseId,
							name,
							description,
							lecturer: null,
							tags,
							start_at: startAt,
							end_at: endAt,
							kind,
							is_hidden: false,
						},
						[
							'course_id',
							'name',
							'description',
							'lecturer',
							'tags',
							'start_at',
							'end_at',
							'kind',
							'is_hidden',
						],
						['id'],
					)
					await client.query(insert.sql, insert.params)
					existingKeys.add(key)
					createdCount += 1
				}

				return c.json({ created: createdCount })
			} finally {
				client.release()
			}
		},
	)

	app.get('/api/integrations/kandidaterna/courses', async (c) => {
		const courses = await listDirectories(KANDIDATERNA_ROOT)
		const results = []
		for (const courseId of courses) {
			const coursePath = join(KANDIDATERNA_ROOT, courseId)
			const jsonFiles = (await readdir(coursePath)).filter((file) =>
				file.endsWith('_all.json'),
			)
			const jsonPath = jsonFiles[0] ? join(coursePath, jsonFiles[0]) : null
			const payload = jsonPath
				? await readJsonFile<{ category_name?: string; total_posts?: number }>(jsonPath)
				: null
			const filesCount = await countFiles(join(coursePath, 'files'))
			results.push({
				id: courseId,
				name: payload?.category_name ?? courseId,
				total_posts: payload?.total_posts ?? null,
				resource_count: filesCount,
			})
		}
		return c.json({ courses: results })
	})

	app.get('/api/integrations/kandidaterna/courses/:courseId/resources', async (c) => {
		const courseId = c.req.param('courseId')
		const coursePath = join(KANDIDATERNA_ROOT, courseId)
		const jsonFiles = await readdir(coursePath).catch(() => [])
		const jsonFile = jsonFiles.find((file) => file.endsWith('_all.json'))
		if (!jsonFile) {
			return c.json({ error: 'Course not found' }, 404)
		}
		const payload = await readJsonFile<{
			category_name?: string
			posts?: Array<{
				id?: string
				title?: string
				description?: string
				type?: string
				attachments?: Array<{ name?: string; url?: string; downloaded?: boolean }>
			}>
		}>(join(coursePath, jsonFile))
		if (!payload) {
			return c.json({ error: 'Failed to read course data' }, 500)
		}
		const posts =
			payload.posts?.map((post) => ({
				id: post.id ?? '',
				title: post.title ?? '',
				description: post.description ?? null,
				type: post.type ?? null,
				attachments:
					post.attachments?.map((attachment) => ({
						name: attachment.name ?? null,
						url: attachment.url ?? null,
						downloaded: attachment.downloaded ?? false,
					})) ?? [],
			})) ?? []
		return c.json({
			course_id: courseId,
			name: payload.category_name ?? courseId,
			posts,
		})
	})

	app.get('/api/integrations/canvas/courses', async (c) => {
		const entries = await listDirectories(CANVAS_ROOT)
		const courses = []
		for (const entry of entries) {
			if (entry.startsWith('_')) {
				continue
			}
			const coursePath = join(CANVAS_ROOT, entry)
			const info = await readJsonFile<{
				id?: number
				name?: string
				course_code?: string
				calendar?: { ics?: string }
			}>(join(coursePath, '_course_info.json'))
			const modulesPath = join(coursePath, 'modules')
			const moduleCount = (await listDirectories(modulesPath).catch(() => []))?.length ?? 0
			courses.push({
				id: String(info?.id ?? entry),
				name: info?.name ?? entry,
				course_code: info?.course_code ?? null,
				calendar_ics: info?.calendar?.ics ?? null,
				path: coursePath,
				module_count: moduleCount,
			})
		}
		return c.json({ courses })
	})

	app.get('/api/integrations/canvas/courses/:courseId/modules', async (c) => {
		const courseId = c.req.param('courseId')
		const resolved = await resolveCanvasCoursePath(courseId)
		if (!resolved) {
			return c.json({ error: 'Course not found' }, 404)
		}
		const modulesPath = join(resolved.path, 'modules')
		const modules = []
		for (const moduleDir of await listDirectories(modulesPath).catch(() => [])) {
			const modulePath = join(modulesPath, moduleDir)
			const fileCount = await countFiles(modulePath)
			modules.push({
				id: basename(moduleDir),
				name: moduleDir,
				resource_count: fileCount,
			})
		}
		return c.json({ course_id: resolved.id, modules })
	})

	app.get('/api/course-items', zValidator('query', courseItemListQuerySchema), async (c) => {
		const { course_id, kind, q, include_hidden } = c.req.valid('query')
		const pool = requirePool(deps)
		const { sql, params } = buildCourseItemListQuery({
			courseId: course_id,
			kind,
			q,
			includeHidden: include_hidden ?? false,
		})

		const client = await pool.connect()
		try {
			const result = await client.query<CourseItemRow>(sql, params)
			const items = result.rows.map((row) => serializeCourseItemRow(row))
			return c.json({ items, total: items.length })
		} finally {
			client.release()
		}
	})

	app.post('/api/course-items', zValidator('json', courseItemInputSchema), async (c) => {
		const body = c.req.valid('json')
		const pool = requirePool(deps)
		const insertData = {
			course_id: body.course_id,
			name: body.name,
			description: body.description ?? null,
			lecturer: body.lecturer ?? null,
			tags: body.tags ?? [],
			start_at: body.start_at ?? null,
			end_at: body.end_at ?? null,
			kind: body.kind,
			is_hidden: body.is_hidden ?? false,
		}
		const { sql, params } = buildInsertStatement(
			'course_item',
			insertData,
			[
				'course_id',
				'name',
				'description',
				'lecturer',
				'tags',
				'start_at',
				'end_at',
				'kind',
				'is_hidden',
			],
			[
				'id',
				'course_id',
				'created_at',
				'modified_at',
				'name',
				'description',
				'lecturer',
				'tags',
				'start_at',
				'end_at',
				'kind',
				'is_hidden',
			],
		)

		const client = await pool.connect()
		try {
			const result = await client.query<CourseItemRow>(sql, params)
			const row = result.rows[0]
			if (!row) {
				return c.json({ error: 'Failed to create course item' }, 500)
			}
			return c.json({ item: serializeCourseItemRow(row) })
		} finally {
			client.release()
		}
	})

	app.get(
		'/api/course-items/:itemId',
		zValidator('param', courseItemIdParamSchema),
		async (c) => {
			const { itemId } = c.req.valid('param')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const result = await client.query<CourseItemRow>(
					`SELECT id, course_id, created_at, modified_at, name, description, lecturer, tags, start_at, end_at, kind, is_hidden
FROM course_item
WHERE id = $1;`,
					[itemId],
				)
				const row = result.rows[0]
				if (!row) {
					return c.json({ error: 'Course item not found' }, 404)
				}
				return c.json({ item: serializeCourseItemRow(row) })
			} finally {
				client.release()
			}
		},
	)

	app.put(
		'/api/course-items/:itemId',
		zValidator('param', courseItemIdParamSchema),
		zValidator('json', courseItemUpdateSchema),
		async (c) => {
			const { itemId } = c.req.valid('param')
			const body = c.req.valid('json')
			const pool = requirePool(deps)
			const { sql, params } = buildUpdateStatement(
				'course_item',
				'id',
				itemId,
				{
					course_id: body.course_id,
					name: body.name,
					description: body.description,
					lecturer: body.lecturer,
					tags: body.tags,
					start_at: body.start_at,
					end_at: body.end_at,
					kind: body.kind,
					is_hidden: body.is_hidden,
				},
				[
					'course_id',
					'name',
					'description',
					'lecturer',
					'tags',
					'start_at',
					'end_at',
					'kind',
					'is_hidden',
				],
				[
					'id',
					'course_id',
					'created_at',
					'modified_at',
					'name',
					'description',
					'lecturer',
					'tags',
					'start_at',
					'end_at',
					'kind',
					'is_hidden',
				],
				'modified_at',
			)

			const client = await pool.connect()
			try {
				const result = await client.query<CourseItemRow>(sql, params)
				const row = result.rows[0]
				if (!row) {
					return c.json({ error: 'Course item not found' }, 404)
				}
				return c.json({ item: serializeCourseItemRow(row) })
			} finally {
				client.release()
			}
		},
	)

	app.delete(
		'/api/course-items/:itemId',
		zValidator('param', courseItemIdParamSchema),
		async (c) => {
			const { itemId } = c.req.valid('param')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const result = await client.query<{ id: number }>(
					'DELETE FROM course_item WHERE id = $1 RETURNING id;',
					[itemId],
				)
				if (!result.rows[0]) {
					return c.json({ error: 'Course item not found' }, 404)
				}
				return c.json({ success: true })
			} finally {
				client.release()
			}
		},
	)

	app.post(
		'/api/course-items/:itemId/hide',
		zValidator('param', courseItemIdParamSchema),
		async (c) => {
			const { itemId } = c.req.valid('param')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const result = await client.query<CourseItemRow>(
					`UPDATE course_item
SET is_hidden = TRUE, modified_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, course_id, created_at, modified_at, name, description, lecturer, tags, start_at, end_at, kind, is_hidden;`,
					[itemId],
				)
				const row = result.rows[0]
				if (!row) {
					return c.json({ error: 'Course item not found' }, 404)
				}
				return c.json({ item: serializeCourseItemRow(row) })
			} finally {
				client.release()
			}
		},
	)

	app.post(
		'/api/course-items/:itemId/show',
		zValidator('param', courseItemIdParamSchema),
		async (c) => {
			const { itemId } = c.req.valid('param')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				const result = await client.query<CourseItemRow>(
					`UPDATE course_item
SET is_hidden = FALSE, modified_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, course_id, created_at, modified_at, name, description, lecturer, tags, start_at, end_at, kind, is_hidden;`,
					[itemId],
				)
				const row = result.rows[0]
				if (!row) {
					return c.json({ error: 'Course item not found' }, 404)
				}
				return c.json({ item: serializeCourseItemRow(row) })
			} finally {
				client.release()
			}
		},
	)

	app.post(
		'/api/resources/:resourceId/assign',
		zValidator('param', resourceIdParamSchema),
		zValidator('json', resourceAssignSchema),
		async (c) => {
			const { resourceId } = c.req.valid('param')
			const { course_item_id: courseItemId } = c.req.valid('json')
			const pool = requirePool(deps)
			const client = await pool.connect()
			try {
				if (courseItemId !== null) {
					const courseItem = await client.query<{ course_id: number }>(
						'SELECT course_id FROM course_item WHERE id = $1;',
						[courseItemId],
					)
					if (!courseItem.rows[0]) {
						return c.json({ error: 'Course item not found' }, 404)
					}

					const result = await client.query<ResourceAssignRow>(
						`UPDATE resource
SET course_item_id = $1,
		course_id = $2,
		updated_at = CURRENT_TIMESTAMP
WHERE id = $3
RETURNING id, course_id, course_item_id, updated_at;`,
						[courseItemId, courseItem.rows[0].course_id, resourceId],
					)
					if (!result.rows[0]) {
						return c.json({ error: 'Resource not found' }, 404)
					}
					const row = mapRowDates(result.rows[0], ['updated_at'])
					return c.json({ resource: row })
				}

				const result = await client.query<ResourceAssignRow>(
					`UPDATE resource
SET course_item_id = NULL,
		updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, course_id, course_item_id, updated_at;`,
					[resourceId],
				)
				if (!result.rows[0]) {
					return c.json({ error: 'Resource not found' }, 404)
				}
				const row = mapRowDates(result.rows[0], ['updated_at'])
				return c.json({ resource: row })
			} finally {
				client.release()
			}
		},
	)

	app.get(
		'/api/courses/:courseId/lectures',
		zValidator('query', z.object({ include_hidden: z.coerce.boolean().optional() })),
		async (c) => {
			const courseIdParam = c.req.param('courseId')
			const { include_hidden } = c.req.valid('query')
			const courseId = parseNumericId(courseIdParam)
			const pool = deps.getPool()
			if (!pool || courseId === null) {
				const calendar = await deps.getCalendar()
				const entry = calendar[courseIdParam]
				if (!entry) {
					return c.json({ course_id: courseIdParam, lectures: [] })
				}
				const lectures = (entry.forelasningar ?? []).map((lecture, index) => ({
					id: `${courseIdParam}-lec-${index + 1}`,
					number: index + 1,
					title: lecture.title,
					date: lecture.date,
					start: lecture.start,
					end: lecture.end,
					duration: calcDuration(lecture.start, lecture.end),
					content_count: 0,
					is_completed: false,
				}))
				return c.json({ course_id: courseIdParam, lectures })
			}

			const client = await pool.connect()
			try {
				const result = await client.query<LectureRow>(
					buildLecturesSql(include_hidden ?? false),
					[courseId],
				)
				const lectures = result.rows.map((row) => {
					const start = row.start_time ?? ''
					const end = row.end_time ?? ''
					return {
						id: String(row.id),
						number: row.number,
						title: row.name,
						date: row.start_date ?? '',
						start,
						end,
						duration: start && end ? calcDuration(start, end) : '',
						content_count: Number(row.content_count ?? 0),
						is_completed: false,
					}
				})
				return c.json({ course_id: String(courseId), lectures })
			} finally {
				client.release()
			}
		},
	)

	app.get(
		'/api/courses/:courseId/labs',
		zValidator('query', z.object({ include_hidden: z.coerce.boolean().optional() })),
		async (c) => {
			const courseIdParam = c.req.param('courseId')
			const { include_hidden } = c.req.valid('query')
			const courseId = parseNumericId(courseIdParam)
			const pool = deps.getPool()
			if (!pool || courseId === null) {
				const calendar = await deps.getCalendar()
				const entry = calendar[courseIdParam]
				if (!entry) {
					return c.json({ course_id: courseIdParam, labs: [] })
				}
				const labs = (entry.labbar ?? []).map((lab, index) => ({
					id: `${courseIdParam}-lab-${index + 1}`,
					number: index + 1,
					title: lab.title,
					date: lab.date,
					start: lab.start,
					end: lab.end,
					duration: calcDuration(lab.start, lab.end),
				}))
				return c.json({ course_id: courseIdParam, labs })
			}

			const client = await pool.connect()
			try {
				const result = await client.query<LabRow>(buildLabsSql(include_hidden ?? false), [
					courseId,
				])
				const labs = result.rows.map((row) => {
					const start = row.start_time ?? ''
					const end = row.end_time ?? ''
					return {
						id: String(row.id),
						number: row.number,
						title: row.name,
						date: row.start_date ?? '',
						start,
						end,
						duration: start && end ? calcDuration(start, end) : '',
					}
				})
				return c.json({ course_id: String(courseId), labs })
			} finally {
				client.release()
			}
		},
	)

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
			const { limit = 50, offset = 0, tag, course_id: courseIdParam } = c.req.valid('query')
			const numericCourseId = courseIdParam ? parseNumericId(courseIdParam) : null
			const filterTag =
				tag ??
				(courseIdParam && numericCourseId === null
					? COURSE_TAG_MAP[courseIdParam]
					: undefined)
			const pool = requirePool(deps)

			const client = await pool.connect()
			try {
				let total = 0
				let rows: ResourceRow[] = []

				if (numericCourseId !== null) {
					const countResult = await client.query<{ total: number }>(
						RESOURCES_COUNT_BY_COURSE_SQL,
						[numericCourseId],
					)
					total = Number(countResult.rows[0]?.total ?? 0)
					const result = await client.query<ResourceRow>(RESOURCES_BY_COURSE_SQL, [
						numericCourseId,
						limit,
						offset,
					])
					rows = result.rows
				} else if (filterTag) {
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
						lecture_id: row.course_item_id ? String(row.course_item_id) : null,
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
				type: z.enum(CONTENT_TYPE_VALUES).optional(),
			}),
		),
		async (c) => {
			const { q, limit = 20, type } = c.req.valid('query')
			const pool = requirePool(deps)

			const client = await pool.connect()
			try {
				const result = await client.query<SearchRow>(SEARCH_SQL, [q, limit])
				const results = result.rows
					.map((hit) => {
						const tags = hit.tags ?? []
						const inferredType = inferContentType(hit.filename, tags)
						return {
							resource_id: hit.id,
							title: hit.filename,
							type: inferredType,
							page_number: hit.page_number,
							rank: hit.rank,
							snippet: hit.snippet ?? '',
							tags,
							course_item_id: hit.course_item_id,
						}
					})
					.filter((hit) => (type ? hit.type === type : true))
				return c.json({ query: q, results, total: results.length })
			} finally {
				client.release()
			}
		},
	)
}
