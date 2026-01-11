import type { SessionManager } from '@repo/core/SessionManager'
import type { Rating, SessionItem } from '@repo/core/types'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { formatClozeAnswer, formatClozeQuestion } from '@repo/core/core/cloze'
import { Box, Text, useInput } from 'ink'
import React, { useCallback, useEffect, useState } from 'react'
import { ImageDisplay } from '../components/ImageDisplay.js'
import { extractImagesFromContent, removeImagesFromContent } from '../terminal-image.js'

type Phase = 'question' | 'answer'

interface ReviewProps {
	session: SessionManager
	vaultPath: string
	deckPath: string | null
	deckFilter?: string
	onQuit: () => void
	disableInput?: boolean
}

export function Review({ session, vaultPath, deckPath, deckFilter, disableInput }: ReviewProps) {
	const [currentItem, setCurrentItem] = useState<SessionItem | null>(null)
	const [noteContent, setNoteContent] = useState<string>('')
	const [phase, setPhase] = useState<Phase>('question')
	const [loading, setLoading] = useState(true)
	const [dimensions, setDimensions] = useState({
		width: process.stdout.columns ?? 80,
		height: process.stdout.rows ?? 24,
	})

	// Listen for terminal resize
	useEffect(() => {
		const handleResize = () => {
			setDimensions({
				width: process.stdout.columns ?? 80,
				height: process.stdout.rows ?? 24,
			})
		}
		process.stdout.on('resize', handleResize)
		return () => {
			process.stdout.off('resize', handleResize)
		}
	}, [])

	// Content width: terminal - outer padding(2) - border(2) - inner paddingX(4)
	const contentWidth = Math.max(20, dimensions.width - 8)

	const loadNextItem = useCallback(async () => {
		setLoading(true)
		const next = await session.getNext()

		if (!next) {
			setCurrentItem(null)
			setLoading(false)
			return
		}

		// Filter by deck path (exact prefix) or deck filter (substring)
		const itemFolder = getFolderPath(next.item.notePath)

		if (deckPath !== null && deckPath !== '') {
			// Exact prefix match for deck selection
			if (!itemFolder.startsWith(deckPath) && itemFolder !== deckPath) {
				await loadNextItem()
				return
			}
		} else if (deckFilter !== undefined && deckFilter !== '') {
			// Case-insensitive substring match for --review filter
			if (!itemFolder.toLowerCase().includes(deckFilter.toLowerCase())) {
				await loadNextItem()
				return
			}
		}

		setCurrentItem(next)
		await loadNoteContent(next)
	}, [session, deckPath, deckFilter])

	const loadNoteContent = async (item: SessionItem) => {
		try {
			const fullPath = path.join(vaultPath, item.item.notePath)
			const content = await fs.readFile(fullPath, 'utf-8')
			setNoteContent(content)
			setPhase('question')
			setLoading(false)
		} catch {
			setNoteContent(`[Error reading note: ${item.item.notePath}]`)
			setPhase('question')
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadNextItem()
	}, [])

	// Extract and prepare images for the current content
	const currentImages = React.useMemo(() => {
		if (!currentItem || !noteContent) return []

		// Process content to extract images
		let content = noteContent
		content = stripFrontmatter(content)

		if (currentItem.item.type === 'cloze' && currentItem.item.clozeIndex != null) {
			if (phase === 'question') {
				content = formatClozeQuestion(content, currentItem.item.clozeIndex)
			} else {
				content = formatClozeAnswer(content, currentItem.item.clozeIndex)
			}
		} else if (currentItem.item.type === 'topic') {
			const { front, back } = parseFrontBack(content)
			if (front !== null) {
				if (phase === 'question') {
					content = front
				} else {
					content = `${front}\n\n---\n\n${back}`
				}
			}
		}

		const { imagePaths } = extractImagesFromContent(content, vaultPath)
		return imagePaths
	}, [currentItem, noteContent, phase, vaultPath])

	const handleRating = useCallback(
		async (rating: Rating) => {
			if (!currentItem) return
			await session.recordReview(currentItem.item.id, rating, new Date())
			await loadNextItem()
		},
		[currentItem, session, loadNextItem],
	)

	useInput(
		(input, key) => {
			// Don't handle input if meta/ctrl (let App handle tab switching)
			if (key.meta || key.ctrl) return

			if (phase === 'question') {
				if (key.return || input === ' ') {
					setPhase('answer')
				}
			} else if (phase === 'answer') {
				if (input === '1') void handleRating(1)
				else if (input === '2') void handleRating(2)
				else if (input === '3') void handleRating(3)
				else if (input === '4' || input === ' ') void handleRating(4)
			}
		},
		{ isActive: !disableInput },
	)

	if (loading) {
		return (
			<Box padding={1}>
				<Text>Loading...</Text>
			</Box>
		)
	}

	if (!currentItem) {
		return (
			<Box flexDirection="column" padding={1} justifyContent="center" alignItems="center">
				<Text color="green" bold>
					No cards due!
				</Text>
				<Text color="gray">Switch to Decks (d) to select a different folder</Text>
			</Box>
		)
	}

	// Format content based on item type and phase
	let displayContent = noteContent
	displayContent = stripFrontmatter(displayContent)

	if (currentItem.item.type === 'cloze' && currentItem.item.clozeIndex != null) {
		if (phase === 'question') {
			displayContent = formatClozeQuestion(displayContent, currentItem.item.clozeIndex)
		} else {
			displayContent = formatClozeAnswer(displayContent, currentItem.item.clozeIndex)
		}
	} else if (currentItem.item.type === 'topic') {
		// Handle basic cards with Front/Back sections
		const { front, back } = parseFrontBack(displayContent)
		if (front !== null) {
			// This is a basic card with Front/Back structure
			if (phase === 'question') {
				displayContent = front
			} else {
				displayContent = `${front}\n\n---\n\n${back}`
			}
		}
		// Otherwise, show full content for both phases (standard topic)
	}

	// Remove images from content (they're displayed separately by ImageDisplay)
	displayContent = removeImagesFromContent(displayContent)

	// Convert tabs to spaces (tabs cause alignment issues with borders)
	displayContent = displayContent.replace(/\t/g, '    ')

	// Split into lines and truncate each to fit
	const lines = displayContent.trim().split('\n')
	const truncatedLines = lines.map((line) => {
		if (line.length <= contentWidth) return line
		return `${line.slice(0, contentWidth - 1)}…`
	})

	const borderColor = phase === 'question' ? 'blue' : 'green'

	return (
		<Box flexDirection="column" padding={1} flexGrow={1}>
			{/* Images section */}
			<ImageDisplay imagePaths={currentImages} maxWidth={contentWidth} />

			{/* Header */}
			<Box marginBottom={1}>
				<Text color="gray">
					{currentItem.item.type === 'cloze' ? 'Cloze' : 'Topic'}
					{' • '}
					{currentItem.item.notePath}
				</Text>
			</Box>

			{/* Card content - render border manually */}
			<Box flexDirection="column">
				<Text>
					<Text color={borderColor}>╭{'─'.repeat(contentWidth + 2)}╮</Text>
				</Text>
				<Text>
					<Text color={borderColor}>│</Text> {' '.repeat(contentWidth)}{' '}
					<Text color={borderColor}>│</Text>
				</Text>
				{truncatedLines.map((line, i) => (
					<Text key={i}>
						<Text color={borderColor}>│</Text> {line.padEnd(contentWidth)}{' '}
						<Text color={borderColor}>│</Text>
					</Text>
				))}
				<Text>
					<Text color={borderColor}>│</Text> {' '.repeat(contentWidth)}{' '}
					<Text color={borderColor}>│</Text>
				</Text>
				<Text>
					<Text color={borderColor}>╰{'─'.repeat(contentWidth + 2)}╯</Text>
				</Text>
			</Box>

			{/* Controls */}
			<Box marginTop={1} justifyContent="center">
				{phase === 'question' ? (
					<Text color="gray">Space/Enter to reveal</Text>
				) : (
					<Text>
						<Text color="red">[1] Again</Text>
						{'  '}
						<Text color="yellow">[2] Hard</Text>
						{'  '}
						<Text color="blue">[3] Good</Text>
						{'  '}
						<Text color="green">[4] Easy</Text>
					</Text>
				)}
			</Box>
		</Box>
	)
}

function getFolderPath(notePath: string): string {
	const segments = notePath.split('/')
	if (segments.length <= 1) return ''
	return segments.slice(0, -1).join('/')
}

function stripFrontmatter(content: string): string {
	const lines = content.split('\n')
	if (lines[0]?.trim() !== '---') return content

	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trim() === '---') {
			return lines.slice(i + 1).join('\n')
		}
	}
	return content
}

/**
 * Parse Front/Back sections from basic Anki cards.
 * Returns null for front if no Front/Back structure is found.
 */
function parseFrontBack(content: string): { front: string | null; back: string } {
	// Match ## Front section (may have leading whitespace/newlines)
	// Use negated character class to avoid backtracking
	const frontMatch = content.match(/(?:^|\n)##[ \t]*Front[ \t]*\n((?:(?!\n##[ \t]*Back).)*)/is)
	const backMatch = content.match(/\n##[ \t]*Back[ \t]*\n(.*)$/is)

	if (frontMatch && backMatch) {
		return {
			front: frontMatch[1]?.trim() ?? '',
			back: backMatch[1]?.trim() ?? '',
		}
	}

	return { front: null, back: content }
}
