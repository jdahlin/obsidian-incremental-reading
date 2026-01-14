import type { Exam } from '@/lib/api'
import { AlarmClock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExamCountdownProps {
	exam: Exam
	daysUntil: number
}

const getUrgencyStyles = (daysUntil: number) => {
	if (daysUntil <= 7) {
		return 'bg-red-500/10 text-red-600 border-red-500/20'
	}
	if (daysUntil <= 21) {
		return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
	}
	return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
}

export const ExamCountdown = ({ exam, daysUntil }: Readonly<ExamCountdownProps>) => {
	const urgencyClass = getUrgencyStyles(daysUntil)
	const examDate = new Date(exam.date)

	return (
		<div
			className={cn(
				'rounded-xl border px-5 py-4 flex items-center justify-between gap-4',
				urgencyClass,
			)}
		>
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center">
					<AlarmClock className="w-5 h-5" />
				</div>
				<div>
					<p className="text-sm uppercase tracking-wide opacity-70">Next exam</p>
					<h3 className="text-lg font-semibold text-foreground">{exam.title}</h3>
					<p className="text-sm text-muted-foreground flex items-center gap-1.5">
						<Calendar className="w-4 h-4" />
						{examDate.toLocaleDateString('sv-SE', {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
						})}
					</p>
				</div>
			</div>
			<div className="text-right">
				<p className="text-3xl font-bold">{daysUntil}</p>
				<p className="text-sm text-muted-foreground">days remaining</p>
			</div>
		</div>
	)
}
