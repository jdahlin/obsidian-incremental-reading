const CLOZE_REGEX = /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/g;

export function parseClozeIndices(content: string): number[] {
	const indices = new Set<number>();
	for (const match of content.matchAll(/\{\{c(\d+)::/g)) {
		const value = Number(match[1]);
		if (Number.isFinite(value)) indices.add(value);
	}
	return Array.from(indices).sort((a, b) => a - b);
}

export function getNextClozeIndex(content: string): number {
	const highest = getHighestClozeIndex(content);
	return highest ? highest + 1 : 1;
}

export function getHighestClozeIndex(content: string): number | null {
	let max = 0;
	for (const match of content.matchAll(/\{\{c(\d+)::/g)) {
		const value = Number(match[1]);
		if (Number.isFinite(value)) max = Math.max(max, value);
	}
	return max > 0 ? max : null;
}

export function formatClozeQuestion(content: string, clozeIndex: number): string {
	return content.replace(CLOZE_REGEX, (_match, index, text, hint) => {
		const current = Number(index);
		if (current !== clozeIndex) return String(text);
		return hint ? `[...] (${hint})` : '[...]';
	});
}

export function formatClozeAnswer(content: string, clozeIndex: number): string {
	return content.replace(CLOZE_REGEX, (_match, _index, text) => String(text));
}

export function escapeHtmlText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
