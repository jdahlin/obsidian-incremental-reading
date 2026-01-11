import type { ReviewPhase } from '@repo/core/core/content'
import type { ReviewItem } from '@repo/core/core/types'
import type { App } from 'obsidian'
import { parseClozeIndices } from '@repo/core/core/cloze'
import { extractSection, formatReviewContent } from '@repo/core/core/content'
import { hasImageOcclusionSyntax, parseImageOcclusionRects } from '@repo/core/core/image-occlusion'
import { MarkdownRenderer, TFile } from 'obsidian'
import { syncNoteToSidecar } from '../data/sync'

export type { ReviewPhase } from '@repo/core/core/content'

export interface ContentLoaderDeps {
	app: App
	view: unknown
	extractTag: string
}

/**
 * Loads a review item's markdown content and returns rendered HTML.
 *
 * - Cloze items are rendered in question/answer format.
 * - Basic items show Front on question, Front+Back on answer.
 * - Image occlusion items show the image (mask handling TBD).
 * - Topic items render the full note.
 * - If a cloze index is missing from the sidecar, we try to re-sync first.
 */
export async function loadReviewItemHtml(
	deps: ContentLoaderDeps,
	item: ReviewItem | null,
	phase: ReviewPhase,
): Promise<string> {
	if (!item) return ''

	const file = item.noteFile ?? deps.app.vault.getAbstractFileByPath(item.notePath)
	if (!(file instanceof TFile)) return ''

	try {
		const rawContent = await deps.app.vault.read(file)

		// Cloze: check if index exists, re-sync if missing
		if (item.type === 'item' && typeof item.clozeIndex === 'number' && item.clozeIndex !== 0) {
			const indices = parseClozeIndices(rawContent)
			if (!indices.includes(item.clozeIndex)) {
				await syncNoteToSidecar(deps.app, file, deps.extractTag)
			}
		}

		// Image occlusion needs special HTML overlay handling
		if (item.type === 'image_occlusion') {
			const clozeIndex = typeof item.clozeIndex === 'number' ? item.clozeIndex : 1
			const formatted = formatImageOcclusion(rawContent, phase, clozeIndex)
			return await renderMarkdownToHtml(deps.app, formatted, item.notePath, deps.view)
		}

		// Cloze, basic, and topic cards use shared formatter
		const formatted = formatReviewContent(rawContent, item.type, phase, item.clozeIndex)
		return await renderMarkdownToHtml(deps.app, formatted, item.notePath, deps.view)
	} catch (error) {
		console.error('IR: failed to load item content', error)
		return '<p>Failed to load content</p>'
	}
}

/**
 * Format image occlusion card content for question/answer phase.
 * Supports two formats:
 * 1. Native Anki IO: {{c1::image-occlusion:rect:left=.X:top=.Y:width=.W:height=.H}}
 * 2. Image Occlusion Enhanced: Separate Question Mask/Answer Mask SVG sections
 *
 * Question: Show Image with occlusion overlay(s)
 * Answer: Reveal current region (remove its overlay)
 */
function formatImageOcclusion(content: string, phase: ReviewPhase, clozeIndex: number): string {
	// Check for native Anki Image Occlusion format (coordinate-based)
	if (hasImageOcclusionSyntax(content)) {
		return formatNativeImageOcclusion(content, phase, clozeIndex)
	}

	// Try Enhanced format with separate sections
	const header = extractSection(content, 'Header')
	const image = extractSection(content, 'Image')
	const questionMask = extractSection(content, 'Question Mask')
	const answerMask = extractSection(content, 'Answer Mask')
	const footer = extractSection(content, 'Footer')
	const remarks = extractSection(content, 'Remarks')

	// Check if we have Image Occlusion structure
	if (image === null) {
		// No Image section found - might be different format, show full content
		return content
	}

	// Extract image path from markdown: ![](path) or ![alt](path)
	const imageMatch = image.match(/!\[[^\]]*\]\(([^)]+)\)/)
	const imagePath = imageMatch?.[1]

	// Extract mask path if available
	const qMaskMatch = questionMask?.match(/!\[[^\]]*\]\(([^)]+)\)/)
	const qMaskPath = qMaskMatch?.[1]
	const aMaskMatch = answerMask?.match(/!\[[^\]]*\]\(([^)]+)\)/)
	const aMaskPath = aMaskMatch?.[1]

	if (phase === 'question' && imagePath !== undefined && qMaskPath !== undefined) {
		// Question phase: overlay question mask on image
		const parts: string[] = []
		if (header !== null) parts.push(header)
		parts.push(createImageOcclusionHtml(imagePath, qMaskPath))
		if (footer !== null) parts.push(`*${footer}*`)
		return parts.join('\n\n')
	}

	if (phase === 'answer') {
		// Answer phase: show image without mask (or with answer mask for context)
		const parts: string[] = []
		if (header !== null) parts.push(`## ${header}`)
		if (imagePath !== undefined && aMaskPath !== undefined) {
			parts.push(createImageOcclusionHtml(imagePath, aMaskPath))
		} else {
			parts.push(image)
		}
		if (footer !== null) parts.push(footer)
		if (remarks !== null) parts.push(`**Remarks:** ${remarks}`)
		return parts.join('\n\n')
	}

	// Fallback: just show the image section
	const parts: string[] = []
	if (header !== null) parts.push(header)
	parts.push(image)
	if (footer !== null) parts.push(`*${footer}*`)
	return parts.join('\n\n')
}

/**
 * Format native Anki Image Occlusion (coordinate-based).
 * Parses {{cN::image-occlusion:rect:...}} syntax and generates CSS overlays.
 */
function formatNativeImageOcclusion(
	content: string,
	phase: ReviewPhase,
	clozeIndex: number,
): string {
	const rects = parseImageOcclusionRects(content)
	if (rects.length === 0) {
		return content
	}

	// Extract sections for native format
	const header = extractSection(content, 'Header')
	const image = extractSection(content, 'Image')
	const backExtra = extractSection(content, 'Back Extra')
	const comments = extractSection(content, 'Comments')

	// Extract image path
	const imageMatch = image?.match(/!\[[^\]]*\]\(([^)]+)\)/)
	const imagePath = imageMatch?.[1]

	if (imagePath === undefined) {
		return content
	}

	// Generate overlay divs for occlusion rectangles
	const overlayHtml = createNativeOcclusionHtml(imagePath, rects, phase, clozeIndex)

	const parts: string[] = []
	if (header !== null) parts.push(header)
	parts.push(overlayHtml)

	if (phase === 'answer') {
		if (backExtra !== null) parts.push(backExtra)
		if (comments !== null) parts.push(`**Comments:** ${comments}`)
	}

	return parts.join('\n\n')
}

/**
 * Create HTML for native image occlusion with CSS overlay divs.
 * Each rectangle becomes a positioned div over the image.
 */
function createNativeOcclusionHtml(
	imagePath: string,
	rects: ReturnType<typeof parseImageOcclusionRects>,
	phase: ReviewPhase,
	currentClozeIndex: number,
): string {
	// Filter rectangles based on phase:
	// Question: show ALL occlusion boxes
	// Answer: show all EXCEPT the current cloze (revealing the answer)
	const visibleRects =
		phase === 'question' ? rects : rects.filter((r) => r.clozeIndex !== currentClozeIndex)

	// Generate overlay div for each visible rectangle
	const overlayDivs = visibleRects
		.map((rect) => {
			const left = (rect.left * 100).toFixed(2)
			const top = (rect.top * 100).toFixed(2)
			const width = (rect.width * 100).toFixed(2)
			const height = (rect.height * 100).toFixed(2)
			const isCurrentCard = rect.clozeIndex === currentClozeIndex
			// Current card's occlusion is highlighted (red), others are neutral (gray)
			const bgColor = isCurrentCard ? '#ff6b6b' : '#808080'

			return `<div class="io-rect" style="position: absolute; left: ${left}%; top: ${top}%; width: ${width}%; height: ${height}%; background: ${bgColor}; border: 2px solid black; pointer-events: none;"></div>`
		})
		.join('\n')

	return `<div class="io-wrapper" style="position: relative; display: inline-block;">
<img src="${imagePath}" style="display: block; max-width: 100%;">
${overlayDivs}
</div>`
}

/**
 * Create HTML for image with SVG mask overlay.
 * Uses CSS positioning to layer the mask on top of the image.
 */
function createImageOcclusionHtml(imagePath: string, maskPath: string): string {
	// Return raw HTML that will be rendered by Obsidian
	return `<div class="io-wrapper" style="position: relative; display: inline-block;">
<img src="${imagePath}" style="display: block; max-width: 100%;">
<img src="${maskPath}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
</div>`
}

async function renderMarkdownToHtml(
	app: App,
	markdown: string,
	sourcePath: string,
	view: unknown,
): Promise<string> {
	const container = document.createElement('div')
	await MarkdownRenderer.render(app, markdown, container, sourcePath, view as never)
	const html = container.innerHTML
	return html || container.textContent || ''
}
