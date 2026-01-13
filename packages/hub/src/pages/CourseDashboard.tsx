import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { Sidebar } from '@/components/Sidebar'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MiniCalendar } from '@/components/MiniCalendar'
import { ProfileMenu } from '@/components/ProfileMenu'
import { useCourses } from '@/hooks/useApi'
import { adaptLecture, fetchCourseExams, fetchLectures, Lecture } from '@/lib/api'
import { withHubBase } from '@/lib/paths'

const CourseDashboard = () => {
	const { courseCode } = useParams()
	const navigate = useNavigate()
	const activeCourseCode = courseCode || 'LPG002'

	const { data: courses = [], isLoading: coursesLoading } = useCourses()
	const courseModules = courses.filter((course) => course.code === activeCourseCode)
	const activeModuleId = courseModules[0]?.id || 'fysiologi_1'

	const lectureQueries = useQueries({
		queries: courseModules.map((module) => ({
			queryKey: ['lectures', module.id],
			queryFn: async () => fetchLectures(module.id),
			enabled: courseModules.length > 0,
			select: (data: Lecture[]) => data.map(adaptLecture),
		})),
	})

	const examQueries = useQueries({
		queries: courseModules.map((module) => ({
			queryKey: ['exams', module.id],
			queryFn: async () => fetchCourseExams(module.id),
			enabled: courseModules.length > 0,
		})),
	})

	const modulesWithProgress = useMemo(() => {
		return courseModules.map((module, index) => {
			const lectures = lectureQueries[index]?.data || []
			const completedCount = lectures.filter((lecture) => lecture.isCompleted).length
			const totalCount = lectures.length || module.lecture_count
			const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
			return {
				module,
				lectures,
				completedCount,
				totalCount,
				percentage,
			}
		})
	}, [courseModules, lectureQueries])

	const upcomingExams = useMemo(() => {
		const today = new Date().toISOString().split('T')[0]
		return examQueries
			.flatMap((query, index) =>
				(query.data || []).map((exam) => ({
					exam,
					module: courseModules[index],
				})),
			)
			.filter(({ exam }) => exam.date >= today)
			.sort((a, b) => a.exam.date.localeCompare(b.exam.date))
			.slice(0, 5)
	}, [examQueries, courseModules])

	const calendarEvents = useMemo(() => {
		const lectureEvents = modulesWithProgress.flatMap(({ module, lectures }) =>
			lectures.map((lecture) => ({
				id: lecture.id,
				title: lecture.title,
				date: lecture.date,
				type: 'lecture' as const,
				href: withHubBase(
					`/courses/${activeCourseCode}/${module.id}/lectures/${lecture.number}`,
				),
			})),
		)
		const examEvents = examQueries.flatMap((query, index) =>
			(query.data || []).map((exam) => ({
				id: exam.id,
				title: exam.title,
				date: exam.date,
				type: 'exam' as const,
				href: withHubBase(
					`/courses/${activeCourseCode}/${courseModules[index]?.id || activeModuleId}`,
				),
			})),
		)
		return [...lectureEvents, ...examEvents]
	}, [modulesWithProgress, examQueries, activeCourseCode, courseModules, activeModuleId])

	const isLoading = coursesLoading || lectureQueries.some((query) => query.isLoading)

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar
				courses={courses}
				lectures={modulesWithProgress[0]?.lectures || []}
				exams={examQueries[0]?.data || []}
				courseCode={activeCourseCode}
				activeCourseId={activeModuleId}
				activeLectureId={null}
				onCourseSelect={(newModuleId) =>
					navigate(withHubBase(`/courses/${activeCourseCode}/${newModuleId}`))
				}
				onLectureSelect={(lectureId) => {
					const lecture = modulesWithProgress[0]?.lectures.find(
						(item) => item.id === lectureId,
					)
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
							]}
						/>

						<div>
							<h1 className="font-serif text-3xl font-bold text-foreground">
								{activeCourseCode}
							</h1>
							<p className="text-muted-foreground mt-2">
								Overview of physiology modules, upcoming milestones, and your
								progress across the course.
							</p>
						</div>

						{isLoading ? (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Loading course dashboard...
							</div>
						) : (
							<div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
								<div className="space-y-6">
									<div className="grid gap-4 md:grid-cols-2">
										{modulesWithProgress.map(
											({
												module,
												completedCount,
												totalCount,
												percentage,
											}) => (
												<Link
													key={module.id}
													to={withHubBase(
														`/courses/${activeCourseCode}/${module.id}`,
													)}
													className="content-card flex flex-col gap-3 hover:border-primary/40"
												>
													<div>
														<p className="text-xs uppercase tracking-wide text-muted-foreground">
															Module
														</p>
														<h3 className="text-lg font-semibold text-foreground">
															{module.name.split(' - ')[0]}
														</h3>
														<p className="text-sm text-muted-foreground">
															{module.lecture_count} lectures
														</p>
													</div>
													<div>
														<div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
															<span>{completedCount} completed</span>
															<span>{percentage}%</span>
														</div>
														<div className="h-2 rounded-full bg-muted overflow-hidden">
															<div
																className="h-full bg-primary transition-all"
																style={{ width: `${percentage}%` }}
															/>
														</div>
														<p className="text-xs text-muted-foreground mt-2">
															{totalCount} total sessions
														</p>
													</div>
												</Link>
											),
										)}
									</div>

									<div className="content-card">
										<p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
											Upcoming exams
										</p>
										{upcomingExams.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No upcoming exams scheduled.
											</p>
										) : (
											<div className="space-y-3">
												{upcomingExams.map(({ exam, module }) => (
													<div
														key={exam.id}
														className="flex items-center justify-between"
													>
														<div>
															<p className="font-medium text-foreground">
																{exam.title}
															</p>
															<p className="text-xs text-muted-foreground">
																{new Date(
																	exam.date,
																).toLocaleDateString('sv-SE', {
																	month: 'short',
																	day: 'numeric',
																	weekday: 'short',
																})}
																{module
																	? ` · ${module.name.split(' - ')[0]}`
																	: ''}
															</p>
														</div>
														<span className="text-sm text-muted-foreground">
															{exam.start}-{exam.end}
														</span>
													</div>
												))}
											</div>
										)}
									</div>
								</div>

								<div className="space-y-6">
									<MiniCalendar
										events={calendarEvents}
										currentDate={new Date()}
									/>
									<div className="content-card">
										<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
											Course notes
										</p>
										<p className="text-sm text-muted-foreground">
											Track overall progress and connect modules here in a
											future update.
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}

export default CourseDashboard
