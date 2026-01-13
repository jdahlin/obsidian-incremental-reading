import { Calendar, Clock, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentGrid } from '@/components/ContentGrid'
import { ContentViewer } from '@/components/ContentViewer'
import { ExtractToolbar } from '@/components/ExtractToolbar'
import { ProfileMenu } from '@/components/ProfileMenu'
import { RightPanel } from '@/components/RightPanel'
import { SearchBar } from '@/components/SearchBar'
import { Sidebar } from '@/components/Sidebar'
import { useCourseExams, useCourses, useLectures } from '@/hooks/useApi'
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
	const [selectedContent, setSelectedContent] = useState<ContentItemDisplay | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)

	// Use moduleId from URL or default
	const activeCourseId = moduleId || 'fysiologi_1'
	const activeCourseCode = courseCode || 'LPG002'

	// Fetch data from API
	const { data: courses, isLoading: coursesLoading } = useCourses()
	const { data: lectures, isLoading: lecturesLoading } = useLectures(activeCourseId)
	const { data: exams } = useCourseExams(activeCourseId)

	// Find active lecture by number from URL
	const activeLectureNumber = lectureNumber ? Number.parseInt(lectureNumber, 10) : null
	const activeLecture = activeLectureNumber
		? lectures?.find((l) => l.number === activeLectureNumber)
		: lectures?.[0]

	// No content per lecture yet - needs lecture-to-resource mapping
	const contentItems: never[] = []
	const contentLoading = false

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
										{contentItems.length} item{contentItems.length !== 1 && 's'}
									</span>
								)}
							</div>
							<ContentGrid
								items={contentItems}
								onItemSelect={(item) =>
									setSelectedContent(item as ContentItemDisplay)
								}
								selectedItemId={selectedContent?.id}
								isLoading={contentLoading}
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
