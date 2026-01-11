// Match cloze deletions: {{c1::answer}} or {{c1::answer::hint}}
// Match content that excludes :: and }} patterns to properly capture answer and optional hint
const CLOZE_REGEX = /\{\{c(\d+)::([^:}]+(?::[^:}]+)*)(?:::([^}]+))?\}\}/g

export function parseClozeIndices(content: string): number[] {
	const indices = new Set<number>()
	for (const match of content.matchAll(/\{\{c(\d+)::/g)) {
		const value = Number(match[1])
		if (Number.isFinite(value)) indices.add(value)
	}
	return Array.from(indices).sort((a, b) => a - b)
}

export function getNextClozeIndex(content: string): number {
	const highest = getHighestClozeIndex(content)
	return highest !== null ? highest + 1 : 1
}

export function getHighestClozeIndex(content: string): number | null {
	let max = 0
	for (const match of content.matchAll(/\{\{c(\d+)::/g)) {
		const value = Number(match[1])
		if (Number.isFinite(value)) max = Math.max(max, value)
	}
	return max > 0 ? max : null
}

export function formatClozeQuestion(content: string, clozeIndex: number): string {
	return content.replace(
		CLOZE_REGEX,
		(_match, index: string, text: string, hint: string | undefined) => {
			const current = Number(index)
			if (current !== clozeIndex) return text
			return hint !== undefined && hint !== '' ? `[...] (${hint})` : '[...]'
		},
	)
}

export function formatClozeAnswer(content: string, _clozeIndex: number): string {
	return content.replace(CLOZE_REGEX, (_match, _index, text) => String(text))
}

export function escapeHtmlText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}
