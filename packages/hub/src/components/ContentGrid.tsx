import {
	BookOpen,
	Clock,
	FileQuestion,
	FileText,
	Highlighter,
	Loader2,
	MessageSquare,
	Presentation,
	Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContentType = 'book' | 'video' | 'notes' | 'exam' | 'lecture'

interface ContentItem {
	readonly id: string
	readonly title: string
	readonly type: ContentType
	readonly description: string
	readonly lectureId: string
	readonly pageCount?: number
	readonly duration?: string
	readonly author?: string
	readonly highlights?: number
	readonly annotations?: number
	readonly tags?: readonly string[]
}

interface ContentGridProps {
	readonly items: readonly ContentItem[]
	onItemSelect: (item: Readonly<ContentItem>) => void
	selectedItemId?: string
	isLoading?: boolean
}

const typeIcons: Record<ContentType, React.ReactNode> = {
	book: <BookOpen className="w-5 h-5" />,
	video: <Video className="w-5 h-5" />,
	notes: <FileText className="w-5 h-5" />,
	exam: <FileQuestion className="w-5 h-5" />,
	lecture: <Presentation className="w-5 h-5" />,
}

const typeLabels: Record<ContentType, string> = {
	book: 'Textbook',
	video: 'Video',
	notes: 'Notes',
	exam: 'Past Exam',
	lecture: 'Lecture Slides',
}

const typeBadgeClasses: Record<ContentType, string> = {
	book: 'badge-book',
	video: 'badge-video',
	notes: 'badge-notes',
	exam: 'badge-exam',
	lecture: 'badge-lecture',
}

export const ContentGrid = ({
	items,
	onItemSelect,
	selectedItemId,
	isLoading,
}: Readonly<ContentGridProps>) => {
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
				<p className="text-sm text-muted-foreground">Loading content...</p>
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
					<BookOpen className="w-8 h-8 text-muted-foreground" />
				</div>
				<h3 className="font-serif text-lg font-medium text-foreground mb-1">
					No content yet
				</h3>
				<p className="text-sm text-muted-foreground">
					Content for this lecture will appear here
				</p>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{items.map((item, index) => (
				<button
					key={item.id}
					onClick={() => onItemSelect(item)}
					className={cn(
						'content-card text-left animate-fade-in',
						selectedItemId === item.id && 'ring-2 ring-primary border-primary',
					)}
					style={{ animationDelay: `${index * 50}ms` }}
				>
					<div className="flex items-start gap-4">
						<div
							className={cn(
								'content-badge p-2 rounded-lg',
								typeBadgeClasses[item.type],
							)}
						>
							{typeIcons[item.type]}
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<span className={cn('content-badge', typeBadgeClasses[item.type])}>
									{typeLabels[item.type]}
								</span>
							</div>
							<h3 className="font-medium text-foreground line-clamp-2 mb-1">
								{item.title}
							</h3>
							<p className="text-sm text-muted-foreground line-clamp-2 mb-3">
								{item.description}
							</p>

							<div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
								{item.pageCount && (
									<span className="flex items-center gap-1">
										<FileText className="w-3.5 h-3.5" />
										{item.pageCount} pages
									</span>
								)}
								{item.duration && (
									<span className="flex items-center gap-1">
										<Clock className="w-3.5 h-3.5" />
										{item.duration}
									</span>
								)}
								{item.highlights && item.highlights > 0 && (
									<span className="flex items-center gap-1 text-highlight">
										<Highlighter className="w-3.5 h-3.5" />
										{item.highlights}
									</span>
								)}
								{item.annotations && item.annotations > 0 && (
									<span className="flex items-center gap-1 text-primary">
										<MessageSquare className="w-3.5 h-3.5" />
										{item.annotations}
									</span>
								)}
								{item.tags && item.tags.length > 0 && (
									<div className="flex gap-1">
										{item.tags.slice(0, 2).map((tag) => (
											<span
												key={tag}
												className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
											>
												#{tag}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</button>
			))}
		</div>
	)
}
