// Re-export from core for backwards compatibility
export { flattenDecks } from '@repo/core/review/utils'

export function rowClass(selected: boolean): string {
	return `ir-deck-row${selected ? ' is-selected' : ''}`
}
