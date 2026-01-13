import { useState } from 'react'
import { Brain, HelpCircle, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QuizPanel } from './QuizPanel'
import { TutorChat } from './TutorChat'
import { QuizQuestion } from '@/data/mockData'

interface RightPanelProps {
	quizQuestions: QuizQuestion[]
	lectureTitle: string
}

type PanelType = 'quiz' | 'tutor' | null

export const RightPanel = ({ quizQuestions, lectureTitle }: RightPanelProps) => {
	const [activePanel, setActivePanel] = useState<PanelType>(null)

	const togglePanel = (panel: PanelType) => {
		setActivePanel((current) => (current === panel ? null : panel))
	}

	return (
		<>
			{/* Floating Action Buttons - Always visible on right edge */}
			<div className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 p-2">
				<Button
					variant={activePanel === 'quiz' ? 'default' : 'secondary'}
					size="icon"
					className={cn(
						'h-12 w-12 rounded-l-xl rounded-r-none shadow-lg transition-all',
						activePanel === 'quiz' && 'bg-primary',
					)}
					onClick={() => togglePanel('quiz')}
				>
					<HelpCircle className="w-5 h-5" />
				</Button>
				<Button
					variant={activePanel === 'tutor' ? 'default' : 'secondary'}
					size="icon"
					className={cn(
						'h-12 w-12 rounded-l-xl rounded-r-none shadow-lg transition-all',
						activePanel === 'tutor' && 'bg-primary',
					)}
					onClick={() => togglePanel('tutor')}
				>
					<Brain className="w-5 h-5" />
				</Button>
			</div>

			{/* Slide-out Panel */}
			<div
				className={cn(
					'fixed right-0 top-0 h-screen w-96 max-w-[90vw] z-40',
					'bg-card border-l border-border shadow-2xl',
					'transition-transform duration-300 ease-out',
					activePanel ? 'translate-x-0' : 'translate-x-full',
				)}
			>
				{/* Panel Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
					<div className="flex items-center gap-2">
						{activePanel === 'quiz' && <HelpCircle className="w-5 h-5 text-primary" />}
						{activePanel === 'tutor' && <Brain className="w-5 h-5 text-primary" />}
						<span className="font-medium">
							{activePanel === 'quiz' ? 'Quick Quiz' : 'AI Tutor'}
						</span>
					</div>
					<Button variant="ghost" size="icon" onClick={() => setActivePanel(null)}>
						<X className="w-4 h-4" />
					</Button>
				</div>

				{/* Panel Content */}
				<div className="h-[calc(100vh-57px)] overflow-y-auto scrollbar-thin">
					{activePanel === 'quiz' && (
						<div className="p-4">
							<QuizPanel
								questions={quizQuestions}
								lectureTitle={lectureTitle}
								isEmbedded
							/>
						</div>
					)}
					{activePanel === 'tutor' && (
						<TutorChat lectureContext={lectureTitle} isEmbedded />
					)}
				</div>
			</div>

			{/* Overlay when panel is open */}
			{activePanel && (
				<div
					className="fixed inset-0 bg-background/50 z-30 lg:hidden"
					onClick={() => setActivePanel(null)}
				/>
			)}
		</>
	)
}
