import type { RvCommand } from './types'

export function parseRvScript(input: string): RvCommand[] {
	const lines = input.split(/\r?\n/)
	const commands: RvCommand[] = []
	for (let i = 0; i < lines.length; i += 1) {
		const raw = lines[i] ?? ''
		const trimmed = raw.trim()
		if (!trimmed) continue
		if (trimmed.startsWith('#')) continue
		const tokens = tokenize(trimmed)
		const name = tokens[0]
		if (name === undefined || name === '') continue
		const args = tokens.slice(1)
		commands.push({ name, args, line: i + 1, raw })
	}
	return commands
}

export function parseRvScriptWithExpectations(input: string): {
	commands: RvCommand[]
	expected: string[]
} {
	const lines = input.split(/\r?\n/)
	const commands: RvCommand[] = []
	const expected: string[] = []

	for (let i = 0; i < lines.length; i += 1) {
		const raw = lines[i] ?? ''
		const trimmed = raw.trim()
		if (!trimmed) continue
		if (trimmed.startsWith('#')) continue
		if (trimmed.startsWith('|')) {
			expected.push(trimmed.slice(1).trimStart())
			continue
		}
		const tokens = tokenize(trimmed)
		const name = tokens[0]
		if (name === undefined || name === '') continue
		const args = tokens.slice(1)
		commands.push({ name, args, line: i + 1, raw })
	}

	return { commands, expected }
}

function tokenize(line: string): string[] {
	const tokens: string[] = []
	let current = ''
	let inQuote: '"' | "'" | null = null
	let escapeNext = false

	for (let i = 0; i < line.length; i += 1) {
		const ch = line.charAt(i)
		if (escapeNext) {
			current += ch
			escapeNext = false
			continue
		}
		if (ch === '\\' && inQuote) {
			escapeNext = true
			continue
		}
		if (ch === '"' || ch === "'") {
			if (inQuote === ch) {
				inQuote = null
			} else if (!inQuote) {
				inQuote = ch
			} else {
				current += ch
			}
			continue
		}
		if (!inQuote && /\s/.test(ch)) {
			if (current) {
				tokens.push(current)
				current = ''
			}
			continue
		}
		current += ch
	}
	if (current) tokens.push(current)
	return tokens
}
