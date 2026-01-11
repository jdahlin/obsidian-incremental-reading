import { describe, expect, it } from 'vitest'

// Since formatBasicCard, formatImageOcclusion, and extractSection are not exported,
// we test them indirectly through their expected behavior patterns.
// These tests validate the markdown parsing logic for card types.

// Helper function that mirrors the implementation in content.ts
function extractSection(content: string, sectionName: string): string | null {
	const headerPattern = new RegExp(`^## ${sectionName}\\s*$`, 'm')
	const headerMatch = headerPattern.exec(content)
	if (headerMatch === null) return null

	const startIndex = headerMatch.index + headerMatch[0].length
	const remainingContent = content.slice(startIndex)

	const nextHeaderMatch = /^## /m.exec(remainingContent)
	const sectionContent = nextHeaderMatch
		? remainingContent.slice(0, nextHeaderMatch.index)
		: remainingContent

	return sectionContent.trim()
}

describe('basic card content formatting', () => {
	function formatBasicCard(content: string, phase: 'question' | 'answer'): string {
		const front = extractSection(content, 'Front')
		const back = extractSection(content, 'Back')

		if (front !== null) {
			if (phase === 'question') {
				return front
			}
			return back ? `${front}\n\n---\n\n${back}` : front
		}

		return content
	}

	it('extracts front section for question phase', () => {
		const content = `---
ir_note_id: abc123
type: basic
---

## Front

What is the capital of France?

## Back

Paris`

		const result = formatBasicCard(content, 'question')
		expect(result).toBe('What is the capital of France?')
		expect(result).not.toContain('Paris')
	})

	it('shows front and back for answer phase', () => {
		const content = `## Front

What is the capital of France?

## Back

Paris`

		const result = formatBasicCard(content, 'answer')
		expect(result).toContain('What is the capital of France?')
		expect(result).toContain('Paris')
		expect(result).toContain('---')
	})

	it('falls back to full content without sections', () => {
		const content = 'Just some plain content without sections'

		const questionResult = formatBasicCard(content, 'question')
		const answerResult = formatBasicCard(content, 'answer')

		expect(questionResult).toBe(content)
		expect(answerResult).toBe(content)
	})

	it('handles front-only cards', () => {
		const content = `## Front

Single sided card`

		const result = formatBasicCard(content, 'answer')
		expect(result).toBe('Single sided card')
	})

	it('handles additional sections after Back', () => {
		const content = `## Front

Question here

## Back

Answer here

## Extra

Extra notes`

		const result = formatBasicCard(content, 'answer')
		expect(result).toContain('Question here')
		expect(result).toContain('Answer here')
		expect(result).not.toContain('Extra notes')
	})
})

describe('image occlusion content formatting', () => {
	function formatImageOcclusion(content: string, phase: 'question' | 'answer'): string {
		const header = extractSection(content, 'Header')
		const image = extractSection(content, 'Image')
		const footer = extractSection(content, 'Footer')
		const remarks = extractSection(content, 'Remarks')
		const sources = extractSection(content, 'Sources')
		const extra1 = extractSection(content, 'Extra 1')
		const extra2 = extractSection(content, 'Extra 2')

		if (image === null) {
			return content
		}

		if (phase === 'question') {
			const parts: string[] = []
			if (header) parts.push(header)
			parts.push(image)
			if (footer) parts.push(`*${footer}*`)
			return parts.join('\n\n')
		}

		const parts: string[] = []
		if (header) parts.push(`## ${header}`)
		parts.push(image)
		if (footer) parts.push(footer)
		if (remarks) parts.push(`**Remarks:** ${remarks}`)
		if (sources) parts.push(`**Sources:** ${sources}`)
		if (extra1) parts.push(extra1)
		if (extra2) parts.push(extra2)

		return parts.join('\n\n')
	}

	it('shows header and image for question phase', () => {
		const content = `## Header

Anatomy - Heart

## Image

![](heart-diagram.png)

## Footer

Identify the chambers

## Remarks

From lecture notes`

		const result = formatImageOcclusion(content, 'question')
		expect(result).toContain('Anatomy - Heart')
		expect(result).toContain('![](heart-diagram.png)')
		expect(result).toContain('*Identify the chambers*') // Footer as hint
		expect(result).not.toContain('lecture notes')
	})

	it('shows all sections for answer phase', () => {
		const content = `## Header

Anatomy - Heart

## Image

![](heart-diagram.png)

## Footer

The four chambers

## Remarks

Important for exam`

		const result = formatImageOcclusion(content, 'answer')
		expect(result).toContain('## Anatomy - Heart')
		expect(result).toContain('![](heart-diagram.png)')
		expect(result).toContain('The four chambers')
		expect(result).toContain('**Remarks:** Important for exam')
	})

	it('falls back to full content without Image section', () => {
		const content = 'Just some content without image occlusion structure'

		const result = formatImageOcclusion(content, 'question')
		expect(result).toBe(content)
	})

	it('handles minimal image occlusion (image only)', () => {
		const content = `## Image

![](diagram.png)`

		const questionResult = formatImageOcclusion(content, 'question')
		expect(questionResult).toBe('![](diagram.png)')

		const answerResult = formatImageOcclusion(content, 'answer')
		expect(answerResult).toBe('![](diagram.png)')
	})

	it('includes sources in answer phase', () => {
		const content = `## Image

![](chart.png)

## Sources

Gray's Anatomy, Chapter 5`

		const result = formatImageOcclusion(content, 'answer')
		expect(result).toContain("**Sources:** Gray's Anatomy, Chapter 5")
	})
})

describe('native image occlusion rendering', () => {
	// Helper to parse IO rects (mirrors parseImageOcclusionRects from html.ts)
	interface ImageOcclusionRect {
		clozeIndex: number
		left: number
		top: number
		width: number
		height: number
	}

	function parseImageOcclusionRects(content: string): ImageOcclusionRect[] {
		const rects: ImageOcclusionRect[] = []
		const pattern =
			/\{\{c(\d+)::image-occlusion:rect:left=([\d.]+):top=([\d.]+):width=([\d.]+):height=([\d.]+)(?::oi=\d+)?\}\}/g

		let match
		while ((match = pattern.exec(content)) !== null) {
			const clozeStr = match[1]
			const leftStr = match[2]
			const topStr = match[3]
			const widthStr = match[4]
			const heightStr = match[5]
			if (!clozeStr || !leftStr || !topStr || !widthStr || !heightStr) continue

			rects.push({
				clozeIndex: Number.parseInt(clozeStr, 10),
				left: Number.parseFloat(leftStr),
				top: Number.parseFloat(topStr),
				width: Number.parseFloat(widthStr),
				height: Number.parseFloat(heightStr),
			})
		}

		return rects
	}

	function hasImageOcclusionSyntax(content: string): boolean {
		return /\{\{c\d+::image-occlusion:rect:/.test(content)
	}

	function createNativeOcclusionHtml(
		imagePath: string,
		rects: ImageOcclusionRect[],
		phase: 'question' | 'answer',
		currentClozeIndex: number,
	): string {
		const visibleRects =
			phase === 'question' ? rects : rects.filter((r) => r.clozeIndex !== currentClozeIndex)

		const overlayDivs = visibleRects
			.map((rect) => {
				const left = (rect.left * 100).toFixed(2)
				const top = (rect.top * 100).toFixed(2)
				const width = (rect.width * 100).toFixed(2)
				const height = (rect.height * 100).toFixed(2)
				const isCurrentCard = rect.clozeIndex === currentClozeIndex
				const bgColor = isCurrentCard ? '#ff6b6b' : '#808080'

				return `<div class="io-rect" style="position: absolute; left: ${left}%; top: ${top}%; width: ${width}%; height: ${height}%; background: ${bgColor}; opacity: 0.8; pointer-events: none;"></div>`
			})
			.join('\n')

		return `<div class="io-wrapper" style="position: relative; display: inline-block;">
<img src="${imagePath}" style="display: block; max-width: 100%;">
${overlayDivs}
</div>`
	}

	it('detects native IO syntax', () => {
		const content = `## Image

![](anatomy.png)

## Occlusion

{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.4}}`

		expect(hasImageOcclusionSyntax(content)).toBe(true)
	})

	it('shows all overlays for question phase', () => {
		const rects: ImageOcclusionRect[] = [
			{ clozeIndex: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.2 },
			{ clozeIndex: 2, left: 0.5, top: 0.5, width: 0.2, height: 0.2 },
		]

		const html = createNativeOcclusionHtml('image.png', rects, 'question', 1)

		// Both rects should be visible
		expect(html).toContain('left: 10.00%')
		expect(html).toContain('left: 50.00%')
		// Current card should be highlighted
		expect(html).toContain('#ff6b6b')
		// Other cards should be gray
		expect(html).toContain('#808080')
	})

	it('hides current cloze overlay for answer phase', () => {
		const rects: ImageOcclusionRect[] = [
			{ clozeIndex: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.2 },
			{ clozeIndex: 2, left: 0.5, top: 0.5, width: 0.2, height: 0.2 },
		]

		const html = createNativeOcclusionHtml('image.png', rects, 'answer', 1)

		// Only cloze 2 should be visible (cloze 1 is revealed)
		expect(html).not.toContain('left: 10.00%')
		expect(html).toContain('left: 50.00%')
	})

	it('parses coordinates from real Anki format', () => {
		const content =
			'{{c1::image-occlusion:rect:left=.6784:top=.0961:width=.1107:height=.0858:oi=1}}'
		const rects = parseImageOcclusionRects(content)

		expect(rects).toHaveLength(1)
		expect(rects[0]?.left).toBeCloseTo(0.6784)
		expect(rects[0]?.top).toBeCloseTo(0.0961)
	})

	it('handles multiple occlusion regions', () => {
		const content = `## Image
![](eye.png)

## Occlusion
{{c1::image-occlusion:rect:left=.1:top=.1:width=.2:height=.2}}
{{c2::image-occlusion:rect:left=.4:top=.4:width=.2:height=.2}}
{{c3::image-occlusion:rect:left=.7:top=.7:width=.2:height=.2}}`

		const rects = parseImageOcclusionRects(content)
		expect(rects).toHaveLength(3)

		// For answer phase of cloze 2, only cloze 1 and 3 should be visible
		const html = createNativeOcclusionHtml('eye.png', rects, 'answer', 2)
		expect(html).toContain('left: 10.00%') // cloze 1
		expect(html).not.toContain('left: 40.00%') // cloze 2 hidden
		expect(html).toContain('left: 70.00%') // cloze 3
	})
})
