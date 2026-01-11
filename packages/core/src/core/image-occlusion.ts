/**
 * Image Occlusion utilities for review.
 * Parses native Anki Image Occlusion syntax from cloze fields.
 */

/**
 * Image Occlusion rectangle coordinates.
 * Values are normalized (0-1) relative to the image dimensions.
 */
export interface ImageOcclusionRect {
	clozeIndex: number
	left: number
	top: number
	width: number
	height: number
}

/**
 * Extract image occlusion rectangles from content.
 * Parses format: {{c1::image-occlusion:rect:left=.6784:top=.0961:width=.1107:height=.0858:oi=1}}
 */
export function parseImageOcclusionRects(content: string): ImageOcclusionRect[] {
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

/**
 * Check if content contains native Image Occlusion syntax.
 */
export function hasImageOcclusionSyntax(content: string): boolean {
	return /\{\{c\d+::image-occlusion:rect:/.test(content)
}
