import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { withHubBase } from '@/lib/paths'

export interface CalendarEvent {
	id: string
	title: string
	date: string
	type: 'lecture' | 'exam'
	href: string
}

interface MiniCalendarProps {
	events: CalendarEvent[]
	currentDate: Date
}

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const MiniCalendar = ({ events, currentDate }: MiniCalendarProps) => {
	const navigate = useNavigate()

	const { cells, monthLabel, eventsByDate } = useMemo(() => {
		const year = currentDate.getFullYear()
		const month = currentDate.getMonth()
		const monthStart = new Date(year, month, 1)
		const monthEnd = new Date(year, month + 1, 0)
		const daysInMonth = monthEnd.getDate()
		const startOffset = (monthStart.getDay() + 6) % 7

		const gridCells = Array.from({ length: 42 }, (_, index) => {
			const day = index - startOffset + 1
			const date = new Date(year, month, day)
			return {
				date,
				isCurrentMonth: day >= 1 && day <= daysInMonth,
			}
		})

		const map: Record<string, CalendarEvent[]> = {}
		events.forEach((event) => {
			if (!map[event.date]) {
				map[event.date] = []
			}
			map[event.date].push(event)
		})

		return {
			cells: gridCells,
			monthLabel: monthStart.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
			eventsByDate: map,
		}
	}, [events, currentDate])

	const todayKey = new Date().toISOString().split('T')[0]

	return (
		<div className="content-card">
			<div className="flex items-center justify-between mb-4">
				<h3 className="font-serif text-lg font-semibold text-foreground">Calendar</h3>
				<span className="text-sm text-muted-foreground">{monthLabel}</span>
			</div>
			<div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground mb-2">
				{weekDays.map((day) => (
					<div key={day} className="text-center font-medium">
						{day}
					</div>
				))}
			</div>
			<div className="grid grid-cols-7 gap-2 text-sm">
				{cells.map(({ date, isCurrentMonth }, index) => {
					const dateKey = date.toISOString().split('T')[0]
					const dayEvents = eventsByDate[dateKey] || []
					const isToday = dateKey === todayKey
					const hasEvents = dayEvents.length > 0

					return (
						<button
							key={`${dateKey}-${index}`}
							type="button"
							disabled={!hasEvents}
							onClick={() => {
								if (hasEvents) {
									navigate(withHubBase(dayEvents[0].href))
								}
							}}
							className={cn(
								'relative h-10 rounded-lg flex flex-col items-center justify-center transition-colors',
								isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40',
								hasEvents
									? 'hover:bg-secondary/70 cursor-pointer'
									: 'cursor-default',
								isToday && 'bg-secondary text-foreground font-semibold',
							)}
						>
							<span>{date.getDate()}</span>
							{hasEvents && (
								<span className="mt-1 flex gap-1">
									{dayEvents.slice(0, 3).map((event) => (
										<span
											key={event.id}
											className={cn(
												'h-1.5 w-1.5 rounded-full',
												event.type === 'exam'
													? 'bg-amber-500'
													: 'bg-primary',
											)}
										/>
									))}
								</span>
							)}
						</button>
					)
				})}
			</div>
			<div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
				<div className="flex items-center gap-2">
					<span className="h-2 w-2 rounded-full bg-primary" />
					Lectures
				</div>
				<div className="flex items-center gap-2">
					<span className="h-2 w-2 rounded-full bg-amber-500" />
					Exams
				</div>
			</div>
		</div>
	)
}
