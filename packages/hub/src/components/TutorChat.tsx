import type { ChatMessage } from '@/data/mockData'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { initialChatMessages } from '@/data/mockData'
import { cn } from '@/lib/utils'

interface TutorChatProps {
	lectureContext?: string
	isEmbedded?: boolean
}

const mockResponses = [
	"That's a great question about protein structure! The α-helix and β-sheet are the two main types of secondary structure. The α-helix is stabilized by hydrogen bonds between backbone atoms that are 4 residues apart, while β-sheets are stabilized by hydrogen bonds between adjacent strands.",
	'Based on your course materials, the Ramachandran plot shows allowed φ (phi) and ψ (psi) backbone angles. Most residues fall within specific allowed regions due to steric constraints between atoms. Glycine is special because it has more conformational freedom.',
	'Looking at your lecture slides, Km (Michaelis constant) represents the substrate concentration at which the reaction rate is half of Vmax. A lower Km indicates higher enzyme affinity for the substrate.',
	'From Chapter 4 of Lehninger, quaternary structure refers to the arrangement of multiple polypeptide chains (subunits) in a protein complex. Hemoglobin is a classic example with its α₂β₂ structure.',
]

export const TutorChat = ({ lectureContext, isEmbedded = false }: Readonly<TutorChatProps>) => {
	const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages)
	const [input, setInput] = useState('')
	const [isTyping, setIsTyping] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	const handleSend = async () => {
		if (!input.trim() || isTyping) return

		const userMessage: ChatMessage = {
			id: `msg-${Date.now()}`,
			role: 'user',
			content: input.trim(),
			timestamp: new Date(),
		}

		setMessages((prev) => [...prev, userMessage])
		setInput('')
		setIsTyping(true)

		// Simulate AI response delay
		await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000))

		const aiMessage: ChatMessage = {
			id: `msg-${Date.now() + 1}`,
			role: 'assistant',
			content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
			timestamp: new Date(),
		}

		setMessages((prev) => [...prev, aiMessage])
		setIsTyping(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			void handleSend()
		}
	}

	const suggestedQuestions = [
		'Explain the difference between α-helix and β-sheet',
		'What factors affect enzyme activity?',
		'How does hemoglobin bind oxygen?',
	]

	return (
		<div
			className={cn(
				'bg-card flex flex-col',
				isEmbedded ? 'h-full' : 'rounded-xl border border-border h-[500px]',
			)}
		>
			{/* Header */}
			<div className="flex items-center gap-3 p-4 border-b border-border">
				<div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
					<Sparkles className="w-5 h-5 text-primary" />
				</div>
				<div>
					<h3 className="font-serif font-semibold text-foreground">AI Tutor</h3>
					<p className="text-sm text-muted-foreground">
						{lectureContext
							? `Context: ${lectureContext}`
							: 'Ask anything about the course'}
					</p>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							'flex gap-3 animate-fade-in',
							message.role === 'user' ? 'flex-row-reverse' : '',
						)}
					>
						<div
							className={cn(
								'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
								message.role === 'user'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted',
							)}
						>
							{message.role === 'user' ? (
								<User className="w-4 h-4" />
							) : (
								<Bot className="w-4 h-4 text-muted-foreground" />
							)}
						</div>
						<div
							className={cn(
								'chat-bubble',
								message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai',
							)}
						>
							<p className="text-sm text-foreground whitespace-pre-wrap">
								{message.content}
							</p>
						</div>
					</div>
				))}

				{isTyping && (
					<div className="flex gap-3 animate-fade-in">
						<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
							<Bot className="w-4 h-4 text-muted-foreground" />
						</div>
						<div className="chat-bubble chat-bubble-ai">
							<div className="flex gap-1">
								<span
									className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse-soft"
									style={{ animationDelay: '0ms' }}
								/>
								<span
									className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse-soft"
									style={{ animationDelay: '150ms' }}
								/>
								<span
									className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse-soft"
									style={{ animationDelay: '300ms' }}
								/>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Suggested Questions */}
			{messages.length === 1 && (
				<div className="px-4 py-2 border-t border-border">
					<p className="text-xs font-medium text-muted-foreground mb-2">
						Suggested questions:
					</p>
					<div className="flex flex-wrap gap-2">
						{suggestedQuestions.map((question, i) => (
							<button
								key={i}
								onClick={() => setInput(question)}
								className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full text-secondary-foreground transition-colors"
							>
								{question}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Input */}
			<div className="p-4 border-t border-border">
				<div className="flex items-end gap-3">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask a question about the material..."
						rows={1}
						className="flex-1 bg-search border border-search-border rounded-xl px-4 py-3 resize-none outline-none focus:border-search-focus transition-colors text-foreground placeholder:text-muted-foreground"
						style={{ minHeight: '48px', maxHeight: '120px' }}
					/>
					<Button
						onClick={() => void handleSend()}
						disabled={!input.trim() || isTyping}
						size="icon"
						className="h-12 w-12 rounded-xl"
					>
						<Send className="w-5 h-5" />
					</Button>
				</div>
			</div>
		</div>
	)
}
