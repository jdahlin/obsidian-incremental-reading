/**
 * React Query hooks for API data fetching.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
	adaptContentItem,
	adaptLecture,
	adaptSearchResult,
	fetchContent,
	fetchCourseExams,
	fetchCourseMaterials,
	fetchCourses,
	fetchLectures,
	getNextExam,
	getTodayLecture,
	searchContent,
} from '@/lib/api'

export function useCourses() {
	return useQuery({
		queryKey: ['courses'],
		queryFn: fetchCourses,
	})
}

export function useLectures(courseId: string | null) {
	return useQuery({
		queryKey: ['lectures', courseId],
		// eslint-disable-next-line ts/no-non-null-assertion -- enabled guard ensures courseId is non-null
		queryFn: async () => fetchLectures(courseId!),
		enabled: !!courseId,
		select: (data) => data.map(adaptLecture),
	})
}

export function useContent(courseId: string | null, limit = 50, offset = 0) {
	return useQuery({
		queryKey: ['content', courseId, limit, offset],
		queryFn: async () => fetchContent(limit, offset, courseId ?? undefined),
		enabled: !!courseId,
		select: (data) => ({
			items: data.items.map(adaptContentItem),
			total: data.total,
		}),
	})
}

export function useCourseMaterials(courseId: string | null, limit = 50) {
	return useQuery({
		queryKey: ['materials', courseId, limit],
		// eslint-disable-next-line ts/no-non-null-assertion -- enabled guard ensures courseId is non-null
		queryFn: async () => fetchCourseMaterials(courseId!, limit),
		enabled: !!courseId,
	})
}

export function useCourseExams(courseId: string | null) {
	return useQuery({
		queryKey: ['exams', courseId],
		// eslint-disable-next-line ts/no-non-null-assertion -- enabled guard ensures courseId is non-null
		queryFn: async () => fetchCourseExams(courseId!),
		enabled: !!courseId,
	})
}

export function useSearch(query: string, enabled = true) {
	return useQuery({
		queryKey: ['search', query],
		queryFn: async () => searchContent(query),
		enabled: enabled && query.length >= 2,
		select: (data) => data.map(adaptSearchResult),
	})
}

export function useTodayLecture(courseId: string | null) {
	const lecturesQuery = useLectures(courseId)
	const data = useMemo(
		() => (lecturesQuery.data ? getTodayLecture(lecturesQuery.data) : null),
		[lecturesQuery.data],
	)

	return {
		...lecturesQuery,
		data,
	}
}

export function useNextExam(courseId: string | null) {
	const examsQuery = useCourseExams(courseId)
	const data = useMemo(
		() => (examsQuery.data ? getNextExam(examsQuery.data) : null),
		[examsQuery.data],
	)

	return {
		...examsQuery,
		data,
	}
}
