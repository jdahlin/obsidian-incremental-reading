import type { LectureSummary } from '@/lib/api'
import { Calendar, Clock, ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { withHubBase } from '@/lib/paths'

interface TodayLectureProps {
	lecture: LectureSummary | null
	moduleId: string
}

export const TodayLecture = ({ lecture, moduleId }: Readonly<TodayLectureProps>) => {
	const { courseCode } = useParams()
	const today = new Date().toISOString().split('T')[0]

	if (!lecture) {
		return (
			<div className="content-card">
				<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Today</p>
				<h3 className="text-lg font-semibold text-foreground">No lecture today</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Enjoy a break or revisit past material.
				</p>
			</div>
		)
	}

	const label = lecture.date === today ? "Today's lecture" : 'Next lecture'
	const lectureDate = new Date(lecture.date)
	const lectureHref = courseCode
		? withHubBase(`/courses/${courseCode}/${moduleId}/lectures/${lecture.number}`)
		: '#'

	return (
		<div className="content-card">
			<p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
			<h3 className="text-xl font-semibold text-foreground mb-2">
				{lecture.number}. {lecture.title}
			</h3>
			<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
				<span className="flex items-center gap-1.5">
					<Calendar className="w-4 h-4" />
					{lectureDate.toLocaleDateString('sv-SE', {
						weekday: 'long',
						month: 'short',
						day: 'numeric',
					})}
				</span>
				<span className="flex items-center gap-1.5">
					<Clock className="w-4 h-4" />
					{lecture.start && lecture.end
						? `${lecture.start}-${lecture.end}`
						: lecture.duration}
				</span>
			</div>
			<Link
				to={lectureHref}
				className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
			>
				View lecture
				<ExternalLink className="w-4 h-4" />
			</Link>
		</div>
	)
}
