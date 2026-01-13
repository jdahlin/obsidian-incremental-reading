import { useState, useRef, useEffect } from 'react'
import {
	Search,
	ChevronDown,
	X,
	FileText,
	BookOpen,
	Video,
	FileQuestion,
	Presentation,
	Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/hooks/useApi'

type ContentType = 'book' | 'video' | 'notes' | 'exam' | 'lecture'
type SearchScope = 'lecture' | 'course' | 'all'

interface ContentItem {
	id: string
	title: string
	type: ContentType
	description: string
	lectureId: string
	pageCount?: number
	duration?: string
	author?: string
	tags?: string[]
}

interface SearchBarProps {
	currentLectureId: string | null
	currentLectureTitle?: string
	onResultSelect: (item: ContentItem) => void
}

const typeIcons: Record<ContentType, React.ReactNode> = {
	book: <BookOpen className="w-4 h-4" />,
	video: <Video className="w-4 h-4" />,
	notes: <FileText className="w-4 h-4" />,
	exam: <FileQuestion className="w-4 h-4" />,
	lecture: <Presentation className="w-4 h-4" />,
}

const typeBadgeClasses: Record<ContentType, string> = {
	book: 'badge-book',
	video: 'badge-video',
	notes: 'badge-notes',
	exam: 'badge-exam',
	lecture: 'badge-lecture',
}

export const SearchBar = ({
	currentLectureId,
	currentLectureTitle,
	onResultSelect,
}: SearchBarProps) => {
	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [scope, setScope] = useState<SearchScope>('all')
	const [isFocused, setIsFocused] = useState(false)
	const [showScopeDropdown, setShowScopeDropdown] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query)
		}, 300)
		return () => clearTimeout(timer)
	}, [query])

	// Use API search hook
	const { data: results = [], isLoading } = useSearch(debouncedQuery, isFocused)

	const scopeLabels: Record<SearchScope, string> = {
		lecture: currentLectureTitle ? `in "${currentLectureTitle}"` : 'in lecture',
		course: 'in course',
		all: 'everywhere',
	}

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsFocused(false)
				setShowScopeDropdown(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			setQuery('')
			setIsFocused(false)
			inputRef.current?.blur()
		}
	}

	return (
		<div ref={containerRef} className="relative w-full max-w-2xl">
			{/* Search Input Container */}
			<div
				className={cn(
					'flex items-center gap-2 bg-search border rounded-xl px-4 py-3 transition-all duration-200',
					isFocused
						? 'border-search-focus shadow-glow'
						: 'border-search-border hover:border-muted-foreground/30',
				)}
			>
				{isLoading ? (
					<Loader2 className="w-5 h-5 text-muted-foreground flex-shrink-0 animate-spin" />
				) : (
					<Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
				)}

				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onFocus={() => setIsFocused(true)}
					onKeyDown={handleKeyDown}
					placeholder="Search content, exams, resources..."
					className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
				/>

				{query && (
					<button
						onClick={() => setQuery('')}
						className="p-1 hover:bg-muted rounded-md transition-colors"
					>
						<X className="w-4 h-4 text-muted-foreground" />
					</button>
				)}

				{/* Scope Selector */}
				<div className="relative">
					<button
						onClick={() => setShowScopeDropdown(!showScopeDropdown)}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
					>
						<span>{scopeLabels[scope]}</span>
						<ChevronDown className="w-3.5 h-3.5" />
					</button>

					{showScopeDropdown && (
						<div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-xl shadow-medium overflow-hidden z-50 animate-fade-in">
							{(Object.keys(scopeLabels) as SearchScope[]).map((s) => (
								<button
									key={s}
									onClick={() => {
										setScope(s)
										setShowScopeDropdown(false)
									}}
									className={cn(
										'w-full px-4 py-2.5 text-left text-sm transition-colors',
										scope === s
											? 'bg-primary text-primary-foreground'
											: 'hover:bg-muted text-foreground',
									)}
								>
									Search {scopeLabels[s]}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Search Results Dropdown */}
			{isFocused && query.length >= 2 && results.length > 0 && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-medium overflow-hidden z-40 animate-fade-in max-h-96 overflow-y-auto scrollbar-thin">
					<div className="p-2">
						<p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
							{results.length} result{results.length !== 1 && 's'}
						</p>
						{results.map((item) => (
							<button
								key={`${item.id}-${item.pageCount}`}
								onClick={() => {
									onResultSelect(item as ContentItem)
									setQuery('')
									setIsFocused(false)
								}}
								className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
							>
								<div
									className={cn(
										'content-badge mt-0.5',
										typeBadgeClasses[item.type],
									)}
								>
									{typeIcons[item.type]}
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-medium text-foreground truncate">
										{item.title}
									</p>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{item.description}
									</p>
									{item.tags && item.tags.length > 0 && (
										<div className="flex gap-1 mt-1 flex-wrap">
											{item.tags.slice(0, 3).map((tag) => (
												<span
													key={tag}
													className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
												>
													#{tag}
												</span>
											))}
										</div>
									)}
								</div>
								{item.pageCount && (
									<span className="text-xs text-muted-foreground">
										p.{item.pageCount}
									</span>
								)}
							</button>
						))}
					</div>
				</div>
			)}

			{/* No Results */}
			{isFocused && query.length >= 2 && !isLoading && results.length === 0 && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-medium p-6 z-40 animate-fade-in text-center">
					<Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
					<p className="text-muted-foreground">No results found for "{query}"</p>
					<p className="text-sm text-muted-foreground/70 mt-1">
						Try a different search term
					</p>
				</div>
			)}

			{/* Loading indicator for typing */}
			{isFocused && query.length >= 2 && isLoading && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-medium p-6 z-40 animate-fade-in text-center">
					<Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-spin" />
					<p className="text-muted-foreground">Searching...</p>
				</div>
			)}
		</div>
	)
}
