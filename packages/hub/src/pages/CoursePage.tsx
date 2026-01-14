import { Calendar, Clock, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentGrid } from '@/components/ContentGrid'
import { ContentViewer } from '@/components/ContentViewer'
import { ExtractToolbar } from '@/components/ExtractToolbar'
import { ProfileMenu } from '@/components/ProfileMenu'
import { RightPanel } from '@/components/RightPanel'
import { SearchBar } from '@/components/SearchBar'
import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import {
	useContent,
	useCourseExams,
	useCourseItems,
	useCourses,
	useLectures,
	useSearch,
} from '@/hooks/useApi'
import { assignResourceToCourseItem } from '@/lib/api'
import { withHubBase } from '@/lib/paths'

// Temporary type for content viewer compatibility
interface ContentItemDisplay {
	id: string
	title: string
	type: 'book' | 'video' | 'notes' | 'exam' | 'lecture'
	description: string
	lectureId: string
	pageCount?: number
	duration?: string
	author?: string
	tags?: string[]
}

const CoursePage = () => {
	const { courseCode, moduleId, lectureNumber } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const [selectedContent, setSelectedContent] = useState<ContentItemDisplay | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [assignmentQuery, setAssignmentQuery] = useState('')
	const [debouncedAssignmentQuery, setDebouncedAssignmentQuery] = useState('')
	const [assigningResourceId, setAssigningResourceId] = useState<string | null>(null)
	const [assignmentError, setAssignmentError] = useState<string | null>(null)
	const [assignmentTargets, setAssignmentTargets] = useState<Record<string, string>>({})

	// Use moduleId from URL or default
	const activeCourseId = moduleId || 'fysiologi_1'
	const activeCourseCode = courseCode || 'LPG002'

	// Fetch data from API
	const { data: courses, isLoading: coursesLoading } = useCourses()
	const { data: lectures, isLoading: lecturesLoading } = useLectures(activeCourseId)
	const { data: exams } = useCourseExams(activeCourseId)
	const { data: courseContent, isLoading: courseContentLoading } = useContent(activeCourseId)
	const canAssign = Number.isFinite(Number(activeCourseId))
	const { data: courseItems } = useCourseItems(canAssign ? activeCourseId : null)
	const canAssignToItems = canAssign && (courseItems?.length ?? 0) > 0

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedAssignmentQuery(assignmentQuery)
		}, 300)
		return () => clearTimeout(timer)
	}, [assignmentQuery])

	const { data: assignmentResults = [], isLoading: assignmentLoading } = useSearch(
		debouncedAssignmentQuery,
		debouncedAssignmentQuery.length >= 2,
	)

	// Find active lecture by number from URL
	const activeLectureNumber = lectureNumber ? Number.parseInt(lectureNumber, 10) : null
	const activeLecture = activeLectureNumber
		? lectures?.find((l) => l.number === activeLectureNumber)
		: lectures?.[0]

	const courseContentItems = courseContent?.items ?? []
	const lectureContentItems: never[] = []
	const lectureContentLoading = false

	const courseItemLabelMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const item of courseItems ?? []) {
			const dateLabel = item.start_at
				? new Date(item.start_at).toLocaleDateString('sv-SE', {
						month: 'short',
						day: 'numeric',
					})
				: null
			const label = `${item.kind} · ${item.name}${dateLabel ? ` (${dateLabel})` : ''}`
			map.set(item.id, label)
		}
		return map
	}, [courseItems])

	const assignedItems = courseContentItems.filter((item) => item.lectureId)
	const unassignedItems = courseContentItems.filter((item) => !item.lectureId)

	// Navigate to first lecture when lectures load and no lecture is selected
	useEffect(() => {
		if (lectures && lectures.length > 0 && !lectureNumber) {
			navigate(
				withHubBase(
					`/courses/${activeCourseCode}/${activeCourseId}/lectures/${lectures[0].number}`,
				),
				{ replace: true },
			)
		}
	}, [lectures, lectureNumber, activeCourseCode, activeCourseId, navigate])

	// Handle course selection - navigate to new URL
	const handleCourseSelect = (newModuleId: string) => {
		navigate(withHubBase(`/courses/${activeCourseCode}/${newModuleId}`))
	}

	// Handle lecture selection - navigate to lecture URL
	const handleLectureSelect = (lectureId: string) => {
		const lecture = lectures?.find((l) => l.id === lectureId)
		if (lecture) {
			navigate(
				withHubBase(
					`/courses/${activeCourseCode}/${activeCourseId}/lectures/${lecture.number}`,
				),
			)
		}
	}

	const isLoading = coursesLoading || lecturesLoading

	const handleAssign = async (resourceId: string, courseItemId: string | null) => {
		setAssigningResourceId(resourceId)
		setAssignmentError(null)
		try {
			await assignResourceToCourseItem(resourceId, courseItemId)
			await queryClient.invalidateQueries({ queryKey: ['content', activeCourseId] })
		} catch (err) {
			setAssignmentError(err instanceof Error ? err.message : 'Failed to assign resource')
		} finally {
			setAssigningResourceId(null)
		}
	}

	const updateAssignmentTarget = (resourceId: string, value: string) => {
		setAssignmentTargets((prev) => ({
			...prev,
			[resourceId]: value,
		}))
	}

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			{/* Sidebar */}
			<Sidebar
				courses={courses || []}
				lectures={lectures || []}
				exams={exams || []}
				courseCode={activeCourseCode}
				activeCourseId={activeCourseId}
				activeLectureId={activeLecture?.id || null}
				onCourseSelect={handleCourseSelect}
				onLectureSelect={handleLectureSelect}
				isLoading={isLoading}
			/>

			{/* Main Content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				{/* Header with Search */}
				<header className="h-[73px] flex items-center justify-between px-8 border-b border-border bg-content">
					<SearchBar
						currentLectureId={activeLecture?.id || null}
						currentLectureTitle={activeLecture?.title}
						onResultSelect={(item) => setSelectedContent(item as ContentItemDisplay)}
					/>
					<ProfileMenu />
				</header>

				{/* Content Area */}
				<div className="flex-1 overflow-y-auto scrollbar-thin">
					<div className="max-w-5xl mx-auto px-8 py-8">
						{/* Lecture Header */}
						{activeLecture && (
							<div className="mb-8 animate-fade-in">
								<div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
									<span className="flex items-center gap-1.5">
										<Calendar className="w-4 h-4" />
										{new Date(activeLecture.date).toLocaleDateString('sv-SE', {
											weekday: 'long',
											month: 'long',
											day: 'numeric',
											year: 'numeric',
										})}
									</span>
									<span className="text-muted-foreground/50">·</span>
									<span className="flex items-center gap-1.5">
										<Clock className="w-4 h-4" />
										{activeLecture.duration}
									</span>
								</div>
								<h1 className="font-serif text-3xl font-bold text-foreground">
									{activeLecture.number}. {activeLecture.title}
								</h1>
							</div>
						)}

						{/* Course Assignments */}
						<div className="mb-8 animate-fade-in">
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-serif text-xl font-semibold text-foreground">
									Course Assignments
								</h2>
								<span className="text-sm text-muted-foreground">
									{assignedItems.length} assigned
								</span>
							</div>
							<div className="grid gap-6 lg:grid-cols-2">
								<div className="rounded-2xl border border-border bg-card p-4">
									<div className="flex items-center justify-between mb-3">
										<h3 className="text-sm font-semibold text-foreground">
											Assigned resources
										</h3>
										<span className="text-xs text-muted-foreground">
											{unassignedItems.length} unassigned
										</span>
									</div>
									{courseContentLoading ? (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<Loader2 className="w-4 h-4 animate-spin" />
											Loading assignments...
										</div>
									) : assignedItems.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No resources assigned yet.
										</p>
									) : (
										<div className="space-y-3">
											{assignedItems.map((item) => {
												const selectedTarget =
													assignmentTargets[item.id] ??
													item.lectureId ??
													''
												return (
													<div
														key={item.id}
														className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3"
													>
														<div className="text-sm font-medium text-foreground">
															{item.title}
														</div>
														<div className="text-xs text-muted-foreground">
															Assigned to{' '}
															{courseItemLabelMap.get(
																item.lectureId ?? '',
															) ?? 'Unknown item'}
														</div>
														{canAssignToItems ? (
															<div className="flex flex-wrap items-center gap-2">
																<select
																	className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
																	value={selectedTarget}
																	onChange={(event) =>
																		updateAssignmentTarget(
																			item.id,
																			event.target.value,
																		)
																	}
																>
																	<option value="">
																		Unassigned
																	</option>
																	{courseItems.map(
																		(courseItem) => (
																			<option
																				key={courseItem.id}
																				value={
																					courseItem.id
																				}
																			>
																				{courseItemLabelMap.get(
																					courseItem.id,
																				) ??
																					courseItem.name}
																			</option>
																		),
																	)}
																</select>
																<Button
																	size="sm"
																	variant="secondary"
																	disabled={
																		assigningResourceId ===
																		item.id
																	}
																	onClick={() =>
																		handleAssign(
																			item.id,
																			selectedTarget
																				? selectedTarget
																				: null,
																		)
																	}
																>
																	{assigningResourceId ===
																		item.id && (
																		<Loader2 className="w-4 h-4 animate-spin" />
																	)}
																	Assign
																</Button>
															</div>
														) : (
															<p className="text-xs text-muted-foreground">
																{canAssign
																	? 'Create course items to assign resources.'
																	: 'Assignments are available for imported courses.'}
															</p>
														)}
													</div>
												)
											})}
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-border bg-card p-4">
									<div className="flex items-center justify-between mb-3">
										<h3 className="text-sm font-semibold text-foreground">
											Find and assign
										</h3>
									</div>
									<input
										type="text"
										value={assignmentQuery}
										onChange={(event) => setAssignmentQuery(event.target.value)}
										placeholder="Search for resources to assign..."
										className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
									/>
									<div className="mt-4 space-y-3">
										{assignmentLoading && (
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Loader2 className="w-4 h-4 animate-spin" />
												Searching...
											</div>
										)}
										{!assignmentLoading &&
											debouncedAssignmentQuery.length >= 2 &&
											assignmentResults.length === 0 && (
												<p className="text-sm text-muted-foreground">
													No matching resources found.
												</p>
											)}
										{assignmentResults.slice(0, 6).map((result) => {
											const selectedTarget =
												assignmentTargets[result.id] ?? ''
											return (
												<div
													key={`${result.id}-${result.pageCount ?? 'result'}`}
													className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3"
												>
													<div className="text-sm font-medium text-foreground">
														{result.title}
													</div>
													<div className="text-xs text-muted-foreground">
														{result.description}
													</div>
													{canAssignToItems ? (
														<div className="flex flex-wrap items-center gap-2">
															<select
																className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
																value={selectedTarget}
																onChange={(event) =>
																	updateAssignmentTarget(
																		result.id,
																		event.target.value,
																	)
																}
															>
																<option value="">
																	Select course item
																</option>
																{courseItems.map((courseItem) => (
																	<option
																		key={courseItem.id}
																		value={courseItem.id}
																	>
																		{courseItemLabelMap.get(
																			courseItem.id,
																		) ?? courseItem.name}
																	</option>
																))}
															</select>
															<Button
																size="sm"
																variant="secondary"
																disabled={
																	assigningResourceId ===
																		result.id ||
																	selectedTarget.length === 0
																}
																onClick={() =>
																	handleAssign(
																		result.id,
																		selectedTarget,
																	)
																}
															>
																{assigningResourceId ===
																	result.id && (
																	<Loader2 className="w-4 h-4 animate-spin" />
																)}
																Assign
															</Button>
														</div>
													) : (
														<p className="text-xs text-muted-foreground">
															{canAssign
																? 'Create course items to assign resources.'
																: 'Assignments are available for imported courses.'}
														</p>
													)}
												</div>
											)
										})}
									</div>
								</div>
							</div>
							{assignmentError && (
								<p className="mt-3 text-sm text-destructive">{assignmentError}</p>
							)}
						</div>

						{/* Content Grid */}
						<div>
							<div className="flex items-center justify-between mb-4">
								<h2 className="font-serif text-xl font-semibold text-foreground">
									Course Materials
								</h2>
								{contentLoading ? (
									<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
								) : (
									<span className="text-sm text-muted-foreground">
										{lectureContentItems.length} item
										{lectureContentItems.length !== 1 && 's'}
									</span>
								)}
							</div>
							<ContentGrid
								items={lectureContentItems}
								onItemSelect={(item) =>
									setSelectedContent(item as ContentItemDisplay)
								}
								selectedItemId={selectedContent?.id}
								isLoading={lectureContentLoading}
							/>
						</div>
					</div>
				</div>
			</main>

			{/* Right Panel - Quiz & AI Tutor */}
			<RightPanel quizQuestions={[]} lectureTitle={activeLecture?.title || ''} />

			{/* Extract Toolbar */}
			<ExtractToolbar
				isSelectionMode={isSelectionMode}
				onToggleSelectionMode={() => setIsSelectionMode(!isSelectionMode)}
			/>

			{/* Content Viewer Overlay */}
			{selectedContent && (
				<ContentViewer
					item={selectedContent}
					onClose={() => setSelectedContent(null)}
					isSelectionMode={isSelectionMode}
				/>
			)}
		</div>
	)
}

export default CoursePage
