import { useState } from 'react'
import {
	BookOpen,
	Calendar,
	CheckCircle2,
	ChevronDown,
	Circle,
	FileQuestion,
	GraduationCap,
	LayoutDashboard,
	Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Course } from '@/lib/api'
import { Link } from 'react-router-dom'
import { withHubBase } from '@/lib/paths'

interface Lecture {
	id: string
	number: number
	title: string
	date: string
	duration: string
	contentCount: number
	isCompleted: boolean
}

interface Exam {
	id: string
	number: number
	title: string
	date: string
	start: string
	end: string
	duration: string
	note?: string
}

interface SidebarProps {
	courses: Course[]
	lectures: Lecture[]
	exams: Exam[]
	courseCode: string | null
	activeCourseId: string | null
	activeLectureId: string | null
	onCourseSelect: (courseId: string) => void
	onLectureSelect: (lectureId: string) => void
	isLoading?: boolean
}

export const Sidebar = ({
	courses,
	lectures,
	exams,
	courseCode,
	activeCourseId,
	activeLectureId,
	onCourseSelect,
	onLectureSelect,
	isLoading,
}: SidebarProps) => {
	const [isLecturesExpanded, setIsLecturesExpanded] = useState(true)
	const [isExamsExpanded, setIsExamsExpanded] = useState(true)
	const [showCourseDropdown, setShowCourseDropdown] = useState(false)

	const completedCount = lectures.filter((l) => l.isCompleted).length
	const activeCourse = courses.find((c) => c.id === activeCourseId)
	const dashboardHref =
		courseCode && activeCourseId
			? withHubBase(`/courses/${courseCode}/${activeCourseId}`)
			: null

	return (
		<aside className="w-72 bg-sidebar flex flex-col h-screen border-r border-sidebar-hover">
			{/* Header - matches main header height */}
			<div className="h-[73px] px-5 flex items-center border-b border-sidebar-hover">
				<div className="flex items-center gap-3 w-full">
					<div className="w-10 h-10 rounded-xl bg-sidebar-accent/20 flex items-center justify-center flex-shrink-0">
						<GraduationCap className="w-5 h-5 text-sidebar-accent" />
					</div>
					<div className="flex-1 min-w-0 relative">
						<button
							onClick={() => setShowCourseDropdown(!showCourseDropdown)}
							className="w-full text-left hover:opacity-80 transition-opacity"
						>
							<h1 className="font-serif font-semibold text-sidebar-foreground text-lg truncate">
								{activeCourse?.name.split(' - ')[0] || 'Select Course'}
							</h1>
							<p className="text-xs text-sidebar-muted flex items-center gap-1">
								{activeCourse?.code || ''}
								<ChevronDown className="w-3 h-3" />
							</p>
						</button>

						{/* Course Dropdown */}
						{showCourseDropdown && courses.length > 0 && (
							<div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-medium overflow-hidden z-50 animate-fade-in">
								{courses.map((course) => (
									<button
										key={course.id}
										onClick={() => {
											onCourseSelect(course.id)
											setShowCourseDropdown(false)
										}}
										className={cn(
											'w-full px-4 py-3 text-left transition-colors',
											activeCourseId === course.id
												? 'bg-primary text-primary-foreground'
												: 'hover:bg-muted text-foreground',
										)}
									>
										<div className="font-medium text-sm">{course.name}</div>
										<div className="text-xs opacity-70">
											{course.lecture_count} lectures
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Progress */}
			<div className="px-5 py-4 border-b border-sidebar-hover">
				<div className="flex items-center justify-between mb-2">
					<span className="text-xs font-medium text-sidebar-muted">Course Progress</span>
					<span className="text-xs font-semibold text-sidebar-accent">
						{completedCount}/{lectures.length}
					</span>
				</div>
				<div className="w-full h-1.5 bg-sidebar-hover rounded-full overflow-hidden">
					<div
						className="h-full bg-sidebar-accent rounded-full transition-all duration-500"
						style={{
							width:
								lectures.length > 0
									? `${(completedCount / lectures.length) * 100}%`
									: '0%',
						}}
					/>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto scrollbar-thin p-3">
				<div className="mb-4">
					{dashboardHref ? (
						<Link to={dashboardHref} className="sidebar-item w-full">
							<LayoutDashboard className="w-4 h-4 flex-shrink-0" />
							<span className="text-sm font-medium">Module dashboard</span>
						</Link>
					) : (
						<div className="sidebar-item w-full opacity-60 cursor-default">
							<LayoutDashboard className="w-4 h-4 flex-shrink-0" />
							<span className="text-sm font-medium">Module dashboard</span>
						</div>
					)}
				</div>

				{/* Lectures Section */}
				<div className="mb-4">
					<button
						onClick={() => setIsLecturesExpanded(!isLecturesExpanded)}
						className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
					>
						<span className="flex items-center gap-2">
							<BookOpen className="w-3.5 h-3.5" />
							Lectures
							{isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
						</span>
						<ChevronDown
							className={cn(
								'w-4 h-4 transition-transform duration-200',
								!isLecturesExpanded && '-rotate-90',
							)}
						/>
					</button>

					{isLecturesExpanded && (
						<div className="mt-1 space-y-0.5">
							{lectures.map((lecture) => (
								<button
									key={lecture.id}
									onClick={() => onLectureSelect(lecture.id)}
									className={cn(
										'sidebar-item w-full group',
										activeLectureId === lecture.id && 'sidebar-item-active',
									)}
								>
									{lecture.isCompleted ? (
										<CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
									) : (
										<Circle className="w-4 h-4 text-sidebar-muted flex-shrink-0" />
									)}
									<div className="flex-1 text-left min-w-0">
										<div className="text-sm font-medium truncate">
											{lecture.number}. {lecture.title}
										</div>
										<div className="flex items-center gap-2 text-xs text-sidebar-muted mt-0.5">
											<Calendar className="w-3 h-3" />
											<span>
												{new Date(lecture.date).toLocaleDateString(
													'sv-SE',
													{ month: 'short', day: 'numeric' },
												)}
											</span>
											<span className="text-sidebar-muted/50">-</span>
											<span>{lecture.duration}</span>
										</div>
									</div>
								</button>
							))}

							{lectures.length === 0 && !isLoading && (
								<div className="px-3 py-4 text-sm text-sidebar-muted text-center">
									No lectures found
								</div>
							)}
						</div>
					)}
				</div>

				{/* Exams Section */}
				{exams && exams.length > 0 && (
					<div>
						<button
							onClick={() => setIsExamsExpanded(!isExamsExpanded)}
							className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
						>
							<span className="flex items-center gap-2">
								<FileQuestion className="w-3.5 h-3.5" />
								Examinations
							</span>
							<ChevronDown
								className={cn(
									'w-4 h-4 transition-transform duration-200',
									!isExamsExpanded && '-rotate-90',
								)}
							/>
						</button>

						{isExamsExpanded && (
							<div className="mt-1 space-y-0.5">
								{exams.map((exam) => {
									const examDate = new Date(exam.date)
									const isPast = examDate < new Date()

									return (
										<div
											key={exam.id}
											className="sidebar-item w-full cursor-default"
										>
											<FileQuestion
												className={cn(
													'w-4 h-4 flex-shrink-0',
													isPast ? 'text-green-500' : 'text-orange-500',
												)}
											/>
											<div className="flex-1 text-left min-w-0">
												<div className="text-sm font-medium truncate">
													{exam.title}
												</div>
												<div className="flex items-center gap-2 text-xs text-sidebar-muted mt-0.5">
													<Calendar className="w-3 h-3" />
													<span>
														{examDate.toLocaleDateString('sv-SE', {
															month: 'short',
															day: 'numeric',
														})}
													</span>
													<span className="text-sidebar-muted/50">-</span>
													<span>
														{exam.start}-{exam.end}
													</span>
												</div>
											</div>
										</div>
									)
								})}
							</div>
						)}
					</div>
				)}
			</nav>
		</aside>
	)
}
