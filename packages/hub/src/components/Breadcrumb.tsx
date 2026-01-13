import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
	readonly label: string
	readonly href: string
}

interface BreadcrumbProps {
	readonly items: readonly BreadcrumbItem[]
}

export const Breadcrumb = ({ items }: Readonly<BreadcrumbProps>) => {
	return (
		<nav
			aria-label="Breadcrumb"
			className="flex items-center gap-2 text-sm text-muted-foreground"
		>
			{items.map((item, index) => {
				const isLast = index === items.length - 1
				return (
					<div key={`${item.label}-${index}`} className="flex items-center gap-2">
						{isLast ? (
							<span className="font-medium text-foreground">{item.label}</span>
						) : (
							<Link
								to={item.href}
								className={cn(
									'hover:text-foreground transition-colors',
									!item.href && 'pointer-events-none',
								)}
							>
								{item.label}
							</Link>
						)}
						{!isLast && <ChevronRight className="w-4 h-4 text-muted-foreground/60" />}
					</div>
				)
			})}
		</nav>
	)
}
