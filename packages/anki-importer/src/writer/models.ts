/**
 * Model Writer
 *
 * Writes model definitions to markdown files.
 */

import type { Model } from '../types.js'
import type { WriteError } from './index.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { sanitizeFilename } from '../ir-types.js'

// =============================================================================
// Markdown Generation
// =============================================================================

/**
 * Model frontmatter for YAML
 */
interface ModelFrontmatter {
	readonly anki_model_id: string
	readonly name: string
	readonly fields: readonly {
		readonly name: string
		readonly ord: number
	}[]
	readonly templates: readonly {
		readonly name: string
		readonly ord: number
		readonly qfmt: string
		readonly afmt: string
	}[]
}

/**
 * Convert Model to markdown content
 */
export function modelToMarkdown(model: Model): string {
	const frontmatter: ModelFrontmatter = {
		anki_model_id: String(model.id),
		name: model.name,
		fields: model.fields.map((f) => ({
			name: f.name,
			ord: f.ord as number,
		})),
		templates: model.templates.map((t) => ({
			name: t.name,
			ord: t.ord as number,
			qfmt: t.qfmt,
			afmt: t.afmt,
		})),
	}

	const yaml = yamlStringify(frontmatter, {
		indent: 2,
		lineWidth: 0,
	})

	return `---\n${yaml}---\n`
}

/**
 * Get filename for a model
 */
export function getModelFilename(model: Model): string {
	return `${sanitizeFilename(model.name)}.md`
}

// =============================================================================
// Write Function
// =============================================================================

/**
 * Write all models to markdown files
 */
export async function writeModels(
	models: readonly Model[],
	outputDir: string,
	errors: WriteError[],
): Promise<number> {
	let count = 0

	for (const model of models) {
		const filename = getModelFilename(model)
		const path = join(outputDir, filename)

		try {
			const content = modelToMarkdown(model)
			await writeFile(path, content, 'utf-8')
			count++
		} catch (err) {
			errors.push({
				type: 'model',
				id: String(model.id),
				path,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return count
}
