/**
 * Deck Writer
 *
 * Writes deck hierarchy to a tree file.
 */

import type {DeckTreeNode} from '../importer/decks.js';
import type { Deck } from '../types.js'
import type { WriteError } from './index.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { buildDeckTree  } from '../importer/decks.js'

// =============================================================================
// Deck Tree Markdown
// =============================================================================

/**
 * Deck tree frontmatter
 */
interface DeckTreeFrontmatter {
	readonly generated: string
	readonly deck_count: number
}

/**
 * Render deck tree node as markdown list item
 */
function renderDeckNode(node: DeckTreeNode, indent: number): string {
	const prefix = '  '.repeat(indent)
	const leafName = node.deck.pathSegments[node.deck.pathSegments.length - 1] ?? node.deck.name
	const line = `${prefix}- **${leafName}** (id: ${node.deck.id})`

	if (node.children.length === 0) {
		return line
	}

	const childLines = node.children
		.map(child => renderDeckNode(child, indent + 1))
		.join('\n')

	return `${line}\n${childLines}`
}

/**
 * Convert deck list to markdown content
 */
export function decksToMarkdown(decks: readonly Deck[]): string {
	const frontmatter: DeckTreeFrontmatter = {
		generated: new Date().toISOString(),
		deck_count: decks.length,
	}

	const yaml = yamlStringify(frontmatter, {
		indent: 2,
		lineWidth: 0,
	})

	const tree = buildDeckTree(decks)
	const treeMarkdown = tree
		.map(node => renderDeckNode(node, 0))
		.join('\n')

	return `---\n${yaml}---\n\n# Deck Hierarchy\n\n${treeMarkdown}\n`
}

// =============================================================================
// Write Function
// =============================================================================

/**
 * Write deck tree to markdown file
 */
export async function writeDecks(
	decks: readonly Deck[],
	outputRoot: string,
	errors: WriteError[],
): Promise<number> {
	const filePath = join(outputRoot, '_deck-tree.md')

	try {
		const content = decksToMarkdown(decks)
		await writeFile(filePath, content, 'utf-8')
		return 1
	} catch (err) {
		errors.push({
			type: 'deck',
			id: 'tree',
			path: filePath,
			error: err instanceof Error ? err.message : String(err),
		})
		return 0
	}
}
