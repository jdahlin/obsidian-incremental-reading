import { cn } from '@/lib/utils'

interface ProgressRingProps {
	completed: number
	total: number
	className?: string
}

export const ProgressRing = ({ completed, total, className }: Readonly<ProgressRingProps>) => {
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
	const clamped = Math.min(100, Math.max(0, percentage))
	const radius = 40
	const stroke = 8
	const normalizedRadius = radius - stroke / 2
	const circumference = 2 * Math.PI * normalizedRadius
	const strokeDashoffset = circumference - (clamped / 100) * circumference

	return (
		<div className={cn('flex items-center justify-center', className)}>
			<div className="relative">
				<svg height={radius * 2} width={radius * 2}>
					<circle
						stroke="hsl(var(--muted))"
						fill="transparent"
						strokeWidth={stroke}
						r={normalizedRadius}
						cx={radius}
						cy={radius}
					/>
					<circle
						stroke="hsl(var(--primary))"
						fill="transparent"
						strokeWidth={stroke}
						strokeLinecap="round"
						strokeDasharray={`${circumference} ${circumference}`}
						style={{ strokeDashoffset }}
						r={normalizedRadius}
						cx={radius}
						cy={radius}
						className="transition-[stroke-dashoffset] duration-700 ease-out"
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-xl font-semibold text-foreground">{clamped}%</span>
					<span className="text-xs text-muted-foreground">completed</span>
				</div>
			</div>
		</div>
	)
}
