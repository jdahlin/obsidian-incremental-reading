/**
 * API client for the lecture navigator backend.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin

// --- Types ---

export type ContentType = 'book' | 'video' | 'notes' | 'exam' | 'lecture'

export interface Course {
	readonly id: string
	readonly name: string
	readonly code: string
	readonly lecture_count: number
	readonly lab_count: number
	readonly exam_count: number
}

export interface Lecture {
	readonly id: string
	readonly number: number
	readonly title: string
	readonly date: string
	readonly start: string
	readonly end: string
	readonly duration: string
	readonly content_count: number
	readonly is_completed: boolean
}

export interface LectureSummary {
	readonly id: string
	readonly number: number
	readonly title: string
	readonly date: string
	readonly start: string
	readonly end: string
	readonly duration: string
	readonly contentCount: number
	readonly isCompleted: boolean
}

export interface Exam {
	readonly id: string
	readonly number: number
	readonly title: string
	readonly date: string
	readonly start: string
	readonly end: string
	readonly duration: string
	readonly note?: string
}

export interface ContentItem {
	readonly id: string
	readonly title: string
	readonly type: ContentType
	readonly description: string
	readonly lecture_id: string | null
	readonly page_count: number | null
	readonly duration: string | null
	readonly author: string | null
	readonly tags: readonly string[]
}

export interface CourseItem {
	readonly id: string
	readonly course_id: number
	readonly created_at: string
	readonly modified_at: string
	readonly name: string
	readonly description: string | null
	readonly lecturer: string | null
	readonly tags: readonly string[]
	readonly start_at: string | null
	readonly end_at: string | null
	readonly kind: string
	readonly is_hidden: boolean
}

export interface SearchResult {
	readonly resource_id: number
	readonly title: string
	readonly type: ContentType
	readonly page_number: number
	readonly rank: number
	readonly snippet: string
	readonly tags: readonly string[]
}

// --- API Responses ---

interface CourseListResponse {
	courses: Course[]
}

interface LectureListResponse {
	course_id: string
	lectures: Lecture[]
}

interface ContentListResponse {
	items: ContentItem[]
	total: number
}

interface SearchResponse {
	query: string
	results: SearchResult[]
	total: number
}

interface CourseItemListResponse {
	items: CourseItem[]
	total: number
}

interface ResourceAssignResponse {
	resource: {
		id: number
		course_id: number | null
		course_item_id: number | null
		updated_at: string
	}
}

// --- API Functions ---

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`API error: ${response.status} ${response.statusText}`)
	}
	return response.json() as Promise<T>
}

export async function fetchCourses(): Promise<Course[]> {
	const data = await fetchJson<CourseListResponse>(`${API_BASE}/api/courses`)
	return data.courses
}

export async function fetchLectures(courseId: string): Promise<Lecture[]> {
	const data = await fetchJson<LectureListResponse>(
		`${API_BASE}/api/courses/${courseId}/lectures`,
	)
	return data.lectures
}

export async function fetchContent(
	limit = 50,
	offset = 0,
	courseId?: string,
): Promise<ContentListResponse> {
	let url = `${API_BASE}/api/content?limit=${limit}&offset=${offset}`
	if (courseId) {
		url += `&course_id=${courseId}`
	}
	return fetchJson<ContentListResponse>(url)
}

export interface Material {
	id: string
	title: string
	type: ContentType
	page_count: number | null
	tags: string[]
}

interface MaterialsResponse {
	course_id: string
	materials: Material[]
	total: number
}

export async function fetchCourseMaterials(courseId: string, limit = 50): Promise<Material[]> {
	const data = await fetchJson<MaterialsResponse>(
		`${API_BASE}/api/courses/${courseId}/materials?limit=${limit}`,
	)
	return data.materials
}

export async function fetchCourseItems(
	courseId: string,
	includeHidden = false,
): Promise<CourseItem[]> {
	const query = new URLSearchParams({ course_id: courseId })
	if (includeHidden) {
		query.set('include_hidden', 'true')
	}
	const data = await fetchJson<CourseItemListResponse>(
		`${API_BASE}/api/course-items?${query.toString()}`,
	)
	return data.items
}

interface ExamsResponse {
	course_id: string
	exams: Exam[]
}

export async function fetchCourseExams(courseId: string): Promise<Exam[]> {
	const data = await fetchJson<ExamsResponse>(`${API_BASE}/api/courses/${courseId}/exams`)
	return data.exams
}

export async function assignResourceToCourseItem(
	resourceId: string,
	courseItemId: string | null,
): Promise<ResourceAssignResponse> {
	const response = await fetch(`${API_BASE}/api/resources/${resourceId}/assign`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			course_item_id: courseItemId === null ? null : Number(courseItemId),
		}),
	})
	if (!response.ok) {
		throw new Error(`API error: ${response.status} ${response.statusText}`)
	}
	return response.json() as Promise<ResourceAssignResponse>
}

export async function searchContent(query: string, limit = 20): Promise<SearchResult[]> {
	if (!query || query.length < 2) {
		return []
	}
	const data = await fetchJson<SearchResponse>(
		`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
	)
	return data.results
}

// --- Adapter functions for frontend compatibility ---

/**
 * Convert API Lecture to frontend-compatible format.
 */
export function adaptLecture(lecture: Readonly<Lecture>): LectureSummary {
	return {
		id: lecture.id,
		number: lecture.number,
		title: lecture.title,
		date: lecture.date,
		start: lecture.start,
		end: lecture.end,
		duration: lecture.duration,
		contentCount: lecture.content_count,
		isCompleted: lecture.is_completed,
	}
}

/**
 * Convert API ContentItem to frontend-compatible format.
 */
export function adaptContentItem(item: Readonly<ContentItem>): {
	id: string
	title: string
	type: ContentType
	description: string
	lectureId: string
	pageCount?: number
	duration?: string
	author?: string
	tags: readonly string[]
} {
	return {
		id: item.id,
		title: item.title,
		type: item.type,
		description: item.description,
		lectureId: item.lecture_id || '',
		pageCount: item.page_count ?? undefined,
		duration: item.duration ?? undefined,
		author: item.author ?? undefined,
		tags: item.tags,
	}
}

/**
 * Convert SearchResult to ContentItem-like format for display.
 */
export function adaptSearchResult(result: Readonly<SearchResult>): {
	id: string
	title: string
	type: ContentType
	description: string
	lectureId: string
	pageCount?: number
	tags: readonly string[]
} {
	return {
		id: String(result.resource_id),
		title: result.title,
		type: result.type,
		description: result.snippet.replace(/<\/?b>/g, ''), // Strip HTML
		lectureId: '',
		pageCount: result.page_number,
		tags: result.tags,
	}
}

export function getTodayLecture<T extends { date: string }>(lectures: readonly T[]): T | null {
	const today = new Date().toISOString().split('T')[0]
	return lectures.find((lecture) => lecture.date === today) || null
}

export function getNextExam<T extends { date: string }>(
	exams: readonly T[],
): { exam: T; daysUntil: number } | null {
	const today = new Date().toISOString().split('T')[0]
	const upcoming = exams
		.filter((exam) => exam.date >= today)
		.sort((a, b) => a.date.localeCompare(b.date))

	if (upcoming.length === 0) {
		return null
	}

	const exam = upcoming[0]
	const daysUntil = Math.ceil(
		(new Date(exam.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
	)
	return { exam, daysUntil }
}
