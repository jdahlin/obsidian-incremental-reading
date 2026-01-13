import { useState } from 'react'
import {
	Scissors,
	StickyNote,
	Highlighter,
	BookmarkPlus,
	Sparkles,
	X,
	ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Extract {
	id: string
	content: string
	source: string
	type: 'extract' | 'note' | 'highlight'
	createdAt: Date
	priority?: number
}

interface ExtractToolbarProps {
	onExtractCreate?: (extract: Extract) => void
	isSelectionMode: boolean
	onToggleSelectionMode: () => void
}

export const ExtractToolbar = ({
	onExtractCreate,
	isSelectionMode,
	onToggleSelectionMode,
}: ExtractToolbarProps) => {
	const [extractCount, setExtractCount] = useState(3)

	const handleCreateExtract = (type: 'extract' | 'note' | 'highlight') => {
		const mockExtract: Extract = {
			id: `ext-${Date.now()}`,
			content: 'Selected text would appear here...',
			source: 'Chapter 4: Protein Structure',
			type,
			createdAt: new Date(),
			priority: type === 'extract' ? 50 : undefined,
		}

		onExtractCreate?.(mockExtract)
		setExtractCount((prev) => prev + 1)

		const labels = {
			extract: 'Extract created for spaced repetition',
			note: 'Note saved to current lecture',
			highlight: 'Text highlighted',
		}

		toast.success(labels[type])
	}

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
			<div
				className={cn(
					'flex items-center gap-2 px-4 py-2.5 rounded-full',
					'bg-card/95 backdrop-blur-xl border border-border shadow-lg',
					'transition-all duration-300',
					isSelectionMode && 'ring-2 ring-primary',
				)}
			>
				{/* Selection Mode Toggle */}
				<Button
					variant={isSelectionMode ? 'default' : 'ghost'}
					size="sm"
					onClick={onToggleSelectionMode}
					className="gap-2"
				>
					<Scissors className="w-4 h-4" />
					<span className="hidden sm:inline">
						{isSelectionMode ? 'Selection Mode' : 'Select Content'}
					</span>
				</Button>

				<div className="w-px h-6 bg-border" />

				{/* Quick Actions */}
				<Button
					variant="ghost"
					size="icon"
					onClick={() => handleCreateExtract('extract')}
					disabled={!isSelectionMode}
					className="relative"
					title="Create Extract (SuperMemo style)"
				>
					<Sparkles className="w-4 h-4" />
					{extractCount > 0 && (
						<span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-[10px] font-bold rounded-full flex items-center justify-center text-accent-foreground">
							{extractCount}
						</span>
					)}
				</Button>

				<Button
					variant="ghost"
					size="icon"
					onClick={() => handleCreateExtract('note')}
					disabled={!isSelectionMode}
					title="Add Note"
				>
					<StickyNote className="w-4 h-4" />
				</Button>

				<Button
					variant="ghost"
					size="icon"
					onClick={() => handleCreateExtract('highlight')}
					disabled={!isSelectionMode}
					title="Highlight"
				>
					<Highlighter className="w-4 h-4" />
				</Button>

				<Button variant="ghost" size="icon" disabled={!isSelectionMode} title="Bookmark">
					<BookmarkPlus className="w-4 h-4" />
				</Button>

				<div className="w-px h-6 bg-border" />

				{/* Extract Priority Dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1 text-xs">
							Priority
							<ChevronDown className="w-3 h-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center">
						<DropdownMenuItem>High (Review in 1 day)</DropdownMenuItem>
						<DropdownMenuItem>Medium (Review in 3 days)</DropdownMenuItem>
						<DropdownMenuItem>Low (Review in 7 days)</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Selection hint */}
			{isSelectionMode && (
				<p className="text-center text-xs text-muted-foreground mt-2 animate-fade-in">
					Select text in the viewer to create extracts
				</p>
			)}
		</div>
	)
}
