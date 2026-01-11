/**
 * HTML to Markdown conversion for Anki card fields.
 * Handles images, audio, cloze deletions, and basic formatting.
 */

export interface HtmlConversionResult {
	markdown: string
	mediaRefs: string[]
}

/**
 * Check if content is primarily SVG (for Image Occlusion masks).
 */
export function isSvgContent(html: string): boolean {
	const trimmed = html.trim()
	return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')
}

/**
 * Preserve SVG content as a markdown code block.
 * Used for Image Occlusion mask fields.
 */
export function preserveSvg(html: string): string {
	const trimmed = html.trim()
	if (!isSvgContent(trimmed)) return trimmed
	return `\`\`\`svg\n${trimmed}\n\`\`\``
}

/**
 * Convert HTML field content to Markdown.
 * Extracts media references for later processing.
 */
export function htmlToMarkdown(html: string): HtmlConversionResult {
	const mediaRefs: string[] = []
	let result = html

	// Extract image references: <img src="file.png"> → ![](file.png)
	result = result.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_, src: string) => {
		mediaRefs.push(src)
		return `![](${src})`
	})

	// Handle Anki sound syntax: [sound:file.mp3] → audio link
	result = result.replace(/\[sound:([^\]]+)\]/g, (_, src: string) => {
		mediaRefs.push(src)
		return `[${src}](${src})`
	})

	// Convert line breaks before stripping other tags
	result = result.replace(/<br\s*\/?>/gi, '\n')
	result = result.replace(/<\/div>\s*<div>/gi, '\n')
	result = result.replace(/<div>/gi, '\n')
	result = result.replace(/<\/div>/gi, '')
	result = result.replace(/<\/p>\s*<p>/gi, '\n\n')
	result = result.replace(/<p>/gi, '')
	result = result.replace(/<\/p>/gi, '\n')

	// Convert formatting tags to markdown
	result = result.replace(/<b>([^<]*)<\/b>/gi, '**$1**')
	result = result.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**')
	result = result.replace(/<i>([^<]*)<\/i>/gi, '*$1*')
	result = result.replace(/<em>([^<]*)<\/em>/gi, '*$1*')
	result = result.replace(/<u>([^<]*)<\/u>/gi, '$1') // no underline in md

	// Handle nested formatting (e.g., <b><i>text</i></b>)
	// Run multiple passes to catch nested tags
	for (let i = 0; i < 3; i++) {
		result = result.replace(/<b>([^<]*)<\/b>/gi, '**$1**')
		result = result.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**')
		result = result.replace(/<i>([^<]*)<\/i>/gi, '*$1*')
		result = result.replace(/<em>([^<]*)<\/em>/gi, '*$1*')
	}

	// Strip remaining HTML tags
	result = result.replace(/<[^>]+>/g, '')

	// Decode HTML entities
	result = decodeHtmlEntities(result)

	// Clean up cloze hints: {{c1::answer::hint}} → {{c1::answer}}
	result = stripClozeHints(result)

	// Normalize whitespace
	result = result.replace(/\n{3,}/g, '\n\n') // max 2 newlines
	result = result.replace(/[ \t]+\n/g, '\n') // trailing spaces
	result = result.trim()

	return { markdown: result, mediaRefs }
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 10)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		)
}

/**
 * Strip hints from cloze deletions.
 * {{c1::answer::hint}} → {{c1::answer}}
 */
export function stripClozeHints(text: string): string {
	// Handle nested content within cloze (including other clozes)
	// Use atomic grouping pattern to prevent backtracking
	return text.replace(/\{\{c(\d+)::([^:}]*(?::[^:}]+)*)::[^}]+\}\}/g, '{{c$1::$2}}')
}

/**
 * Parse native Anki Image Occlusion coordinates from cloze syntax.
 * Format: {{c1::image-occlusion:rect:left=.6784:top=.0961:width=.1107:height=.0858:oi=1}}
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

/**
 * Rewrite media paths in markdown after copying files.
 */
export function rewriteMediaPaths(markdown: string, mediaPathMap: Map<string, string>): string {
	let result = markdown
	for (const [original, vaultPath] of mediaPathMap) {
		// Rewrite image references
		result = result.replace(
			new RegExp(`!\\[\\]\\(${escapeRegex(original)}\\)`, 'g'),
			`![](${vaultPath})`,
		)
		// Rewrite audio/file links
		result = result.replace(
			new RegExp(`\\[${escapeRegex(original)}\\]\\(${escapeRegex(original)}\\)`, 'g'),
			`[${original}](${vaultPath})`,
		)
	}
	return result
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse Anki note fields (separated by unit separator \x1f).
 */
export function parseAnkiFields(flds: string): string[] {
	return flds.split('\x1F')
}

/** Field names that contain SVG mask data for Image Occlusion */
const SVG_MASK_FIELDS = new Set([
	'question mask',
	'answer mask',
	'original mask',
	'qmask',
	'amask',
	'omask',
])

/**
 * Build markdown content from Anki note fields.
 * Returns the combined content and all media references.
 * Preserves SVG content for Image Occlusion mask fields.
 */
export function fieldsToMarkdown(fields: string[], fieldNames: string[]): HtmlConversionResult {
	const allMediaRefs: string[] = []
	const parts: string[] = []

	for (let i = 0; i < fields.length; i++) {
		const fieldContent = fields[i]?.trim()
		if (fieldContent === undefined || fieldContent === '') continue

		const fieldName = fieldNames[i] ?? `Field ${i + 1}`
		const fieldNameLower = fieldName.toLowerCase()

		// Check if this is an SVG mask field
		const isMaskField = SVG_MASK_FIELDS.has(fieldNameLower) || isSvgContent(fieldContent)

		let markdown: string
		let mediaRefs: string[] = []

		if (isMaskField && isSvgContent(fieldContent)) {
			// Preserve SVG content as code block
			markdown = preserveSvg(fieldContent)
		} else {
			// Normal HTML to markdown conversion
			const result = htmlToMarkdown(fieldContent)
			markdown = result.markdown
			mediaRefs = result.mediaRefs
		}

		if (markdown === '') continue

		allMediaRefs.push(...mediaRefs)

		// Add field name as header if there are multiple non-empty fields
		if (fields.filter((f) => f.trim()).length > 1) {
			parts.push(`## ${fieldName}\n\n${markdown}`)
		} else {
			parts.push(markdown)
		}
	}

	return {
		markdown: parts.join('\n\n'),
		mediaRefs: allMediaRefs,
	}
}
