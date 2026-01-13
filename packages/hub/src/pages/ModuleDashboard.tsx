import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Loader2, Settings, Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { Breadcrumb } from '@/components/Breadcrumb'
import { TodayLecture } from '@/components/TodayLecture'
import { ExamCountdown } from '@/components/ExamCountdown'
import { MiniCalendar } from '@/components/MiniCalendar'
import { ProgressRing } from '@/components/ProgressRing'
import { ProfileMenu } from '@/components/ProfileMenu'
import {
	useCourses,
	useLectures,
	useCourseExams,
	useNextExam,
	useTodayLecture,
} from '@/hooks/useApi'
import { withHubBase } from '@/lib/paths'
import { cn } from '@/lib/utils'

const ModuleDashboard = () => {
	const { courseCode, moduleId } = useParams()
	const navigate = useNavigate()
	const activeCourseCode = courseCode || 'LPG002'
	const activeModuleId = moduleId || 'fysiologi_1'

	const { data: courses = [], isLoading: coursesLoading } = useCourses()
	const { data: lectures = [], isLoading: lecturesLoading } = useLectures(activeModuleId)
	const { data: exams = [] } = useCourseExams(activeModuleId)
	const { data: todayLecture } = useTodayLecture(activeModuleId)
	const { data: nextExam } = useNextExam(activeModuleId)

	const activeCourse = courses.find((course) => course.id === activeModuleId)
	const moduleLabel = activeCourse?.name.split(' - ')[0] || activeModuleId

	const lectureForCard = useMemo(() => {
		if (todayLecture) {
			return todayLecture
		}
		const today = new Date().toISOString().split('T')[0]
		return (
			[...lectures]
				.sort((a, b) => a.date.localeCompare(b.date))
				.find((lecture) => lecture.date > today) || null
		)
	}, [lectures, todayLecture])

	const completedCount = lectures.filter((lecture) => lecture.isCompleted).length

	const calendarEvents = useMemo(() => {
		return [
			...lectures.map((lecture) => ({
				id: lecture.id,
				title: lecture.title,
				date: lecture.date,
				type: 'lecture' as const,
				href: withHubBase(
					`/courses/${activeCourseCode}/${activeModuleId}/lectures/${lecture.number}`,
				),
			})),
			...exams.map((exam) => ({
				id: exam.id,
				title: exam.title,
				date: exam.date,
				type: 'exam' as const,
				href: withHubBase(`/courses/${activeCourseCode}/${activeModuleId}`),
			})),
		]
	}, [lectures, exams, activeCourseCode, activeModuleId])

	const isLoading = coursesLoading || lecturesLoading

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar
				courses={courses}
				lectures={lectures}
				exams={exams}
				courseCode={activeCourseCode}
				activeCourseId={activeModuleId}
				activeLectureId={null}
				onCourseSelect={(newModuleId) =>
					navigate(withHubBase(`/courses/${activeCourseCode}/${newModuleId}`))
				}
				onLectureSelect={(lectureId) => {
					const lecture = lectures.find((item) => item.id === lectureId)
					if (lecture) {
						navigate(
							withHubBase(
								`/courses/${activeCourseCode}/${activeModuleId}/lectures/${lecture.number}`,
							),
						)
					}
				}}
				isLoading={isLoading}
			/>

			<main className="flex-1 flex flex-col overflow-hidden">
				<header className="h-[73px] flex items-center justify-end px-8 border-b border-border bg-content">
					<ProfileMenu />
				</header>

				<div className="flex-1 overflow-y-auto scrollbar-thin">
					<div className="max-w-6xl mx-auto px-8 py-8 space-y-6">
						<Breadcrumb
							items={[
								{ label: 'Home', href: withHubBase('/') },
								{
									label: activeCourseCode,
									href: withHubBase(`/courses/${activeCourseCode}`),
								},
								{
									label: moduleLabel,
									href: withHubBase(
										`/courses/${activeCourseCode}/${activeModuleId}`,
									),
								},
							]}
						/>

						<div className="flex flex-col gap-2">
							<h1 className="font-serif text-3xl font-bold text-foreground">
								{moduleLabel}
							</h1>
							<p className="text-muted-foreground">
								{activeCourse?.name ||
									'Module overview and study shortcuts for the coming weeks.'}
							</p>
						</div>

						{isLoading ? (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Loading module data...
							</div>
						) : (
							<div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
								<div className="space-y-6">
									<TodayLecture
										lecture={lectureForCard}
										moduleId={activeModuleId}
									/>

									<div className="grid gap-4 md:grid-cols-3">
										<Link
											to={withHubBase(
												`/courses/${activeCourseCode}/${activeModuleId}/lectures`,
											)}
											className="content-card flex flex-col gap-3 hover:border-primary/40"
										>
											<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
												<CalendarDays className="w-5 h-5 text-primary" />
											</div>
											<div>
												<p className="text-sm font-medium text-foreground">
													Lectures
												</p>
												<p className="text-xs text-muted-foreground">
													View schedule and materials
												</p>
											</div>
										</Link>

										<button
											type="button"
											className={cn(
												'content-card flex flex-col gap-3 text-left',
												'opacity-70 cursor-not-allowed',
											)}
											disabled
										>
											<div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
												<Sparkles className="w-5 h-5 text-accent" />
											</div>
											<div>
												<p className="text-sm font-medium text-foreground">
													Flashcards
												</p>
												<p className="text-xs text-muted-foreground">
													Coming soon
												</p>
											</div>
										</button>

										<button
											type="button"
											className={cn(
												'content-card flex flex-col gap-3 text-left',
												'opacity-70 cursor-not-allowed',
											)}
											disabled
										>
											<div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
												<Settings className="w-5 h-5 text-muted-foreground" />
											</div>
											<div>
												<p className="text-sm font-medium text-foreground">
													Settings
												</p>
												<p className="text-xs text-muted-foreground">
													Module preferences
												</p>
											</div>
										</button>
									</div>

									<div className="content-card">
										<p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
											Recent activity
										</p>
										<div className="text-sm text-muted-foreground">
											Activity feed will appear here once tracking is enabled.
										</div>
									</div>
								</div>

								<div className="space-y-6">
									{nextExam ? (
										<ExamCountdown
											exam={nextExam.exam}
											daysUntil={nextExam.daysUntil}
										/>
									) : (
										<div className="content-card">
											<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
												Exams
											</p>
											<h3 className="text-lg font-semibold text-foreground">
												No upcoming exams
											</h3>
											<p className="text-sm text-muted-foreground mt-1">
												You're clear for now.
											</p>
										</div>
									)}

									<div className="content-card flex items-center justify-between">
										<div>
											<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
												Progress
											</p>
											<h3 className="text-lg font-semibold text-foreground">
												Module completion
											</h3>
											<p className="text-sm text-muted-foreground">
												{completedCount}/{lectures.length} lectures
												completed
											</p>
										</div>
										<ProgressRing
											completed={completedCount}
											total={lectures.length}
										/>
									</div>

									<MiniCalendar
										events={calendarEvents}
										currentDate={new Date()}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}

export default ModuleDashboard
