import type { QuizQuestion } from '@/data/mockData'
import { ArrowRight, Brain, Check, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QuizPanelProps {
	readonly questions: readonly QuizQuestion[]
	lectureTitle: string
	isEmbedded?: boolean
}

export const QuizPanel = ({
	questions,
	lectureTitle,
	isEmbedded = false,
}: Readonly<QuizPanelProps>) => {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
	const [showResult, setShowResult] = useState(false)
	const [score, setScore] = useState(0)
	const [isComplete, setIsComplete] = useState(false)

	const currentQuestion = questions[currentIndex]

	const handleSelectAnswer = (index: number) => {
		if (showResult) return
		setSelectedAnswer(index)
	}

	const handleSubmit = () => {
		if (selectedAnswer === null) return
		setShowResult(true)
		if (selectedAnswer === currentQuestion.correctAnswer) {
			setScore((s) => s + 1)
		}
	}

	const handleNext = () => {
		if (currentIndex < questions.length - 1) {
			setCurrentIndex((i) => i + 1)
			setSelectedAnswer(null)
			setShowResult(false)
		} else {
			setIsComplete(true)
		}
	}

	const handleRestart = () => {
		setCurrentIndex(0)
		setSelectedAnswer(null)
		setShowResult(false)
		setScore(0)
		setIsComplete(false)
	}

	if (questions.length === 0) {
		return (
			<div className={cn('p-6', !isEmbedded && 'bg-card rounded-xl border border-border')}>
				<div className="flex items-center gap-3 mb-4">
					<div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
						<Brain className="w-5 h-5 text-accent" />
					</div>
					<div>
						<h3 className="font-serif font-semibold text-foreground">Quick Quiz</h3>
						<p className="text-sm text-muted-foreground">Test your knowledge</p>
					</div>
				</div>
				<p className="text-muted-foreground text-sm">
					No quiz questions available for this lecture yet.
				</p>
			</div>
		)
	}

	if (isComplete) {
		const percentage = Math.round((score / questions.length) * 100)
		return (
			<div
				className={cn(
					'animate-fade-in p-6',
					!isEmbedded && 'bg-card rounded-xl border border-border',
				)}
			>
				<div className="text-center py-4">
					<div
						className={cn(
							'w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center',
							percentage >= 70 ? 'bg-green-500/20' : 'bg-accent/20',
						)}
					>
						<span
							className={cn(
								'text-2xl font-bold',
								percentage >= 70 ? 'text-green-500' : 'text-accent',
							)}
						>
							{percentage}%
						</span>
					</div>
					<h3 className="font-serif text-xl font-semibold text-foreground mb-2">
						{percentage >= 70 ? 'Great job!' : 'Keep practicing!'}
					</h3>
					<p className="text-muted-foreground mb-6">
						You got {score} out of {questions.length} questions correct
					</p>
					<Button onClick={handleRestart} className="gap-2">
						<RefreshCw className="w-4 h-4" />
						Try Again
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className={cn('p-6', !isEmbedded && 'bg-card rounded-xl border border-border')}>
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
						<Brain className="w-5 h-5 text-accent" />
					</div>
					<div>
						<h3 className="font-serif font-semibold text-foreground">Quick Quiz</h3>
						<p className="text-sm text-muted-foreground">{lectureTitle}</p>
					</div>
				</div>
				<span className="text-sm font-medium text-muted-foreground">
					{currentIndex + 1} / {questions.length}
				</span>
			</div>

			{/* Progress Bar */}
			<div className="w-full h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
				<div
					className="h-full bg-accent rounded-full transition-all duration-300"
					style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
				/>
			</div>

			{/* Question */}
			<p className="text-lg font-medium text-foreground mb-6">{currentQuestion.question}</p>

			{/* Options */}
			<div className="space-y-3 mb-6">
				{currentQuestion.options.map((option, index) => {
					const isSelected = selectedAnswer === index
					const isCorrect = index === currentQuestion.correctAnswer

					let optionClass = 'quiz-option'
					if (showResult) {
						if (isCorrect) optionClass += ' quiz-option-correct'
						else if (isSelected && !isCorrect) optionClass += ' quiz-option-incorrect'
					} else if (isSelected) {
						optionClass += ' quiz-option-selected'
					}

					return (
						<button
							key={index}
							onClick={() => handleSelectAnswer(index)}
							disabled={showResult}
							className={optionClass}
						>
							<div className="flex items-center gap-3">
								<span
									className={cn(
										'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2',
										showResult && isCorrect
											? 'border-green-500 bg-green-500/20 text-green-600'
											: showResult && isSelected && !isCorrect
												? 'border-red-500 bg-red-500/20 text-red-600'
												: isSelected
													? 'border-primary bg-primary/10 text-primary'
													: 'border-border text-muted-foreground',
									)}
								>
									{showResult && isCorrect ? (
										<Check className="w-4 h-4" />
									) : showResult && isSelected && !isCorrect ? (
										<X className="w-4 h-4" />
									) : (
										String.fromCharCode(65 + index)
									)}
								</span>
								<span className="text-foreground">{option}</span>
							</div>
						</button>
					)
				})}
			</div>

			{/* Explanation */}
			{showResult && (
				<div
					className={cn(
						'p-4 rounded-xl mb-6 animate-fade-in',
						selectedAnswer === currentQuestion.correctAnswer
							? 'bg-green-500/10 border border-green-500/30'
							: 'bg-accent/10 border border-accent/30',
					)}
				>
					<p className="text-sm font-medium text-foreground mb-1">
						{selectedAnswer === currentQuestion.correctAnswer
							? '✓ Correct!'
							: '✗ Incorrect'}
					</p>
					<p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
				</div>
			)}

			{/* Actions */}
			<div className="flex justify-end gap-3">
				{!showResult ? (
					<Button onClick={handleSubmit} disabled={selectedAnswer === null}>
						Check Answer
					</Button>
				) : (
					<Button onClick={handleNext} className="gap-2">
						{currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
						<ArrowRight className="w-4 h-4" />
					</Button>
				)}
			</div>
		</div>
	)
}
