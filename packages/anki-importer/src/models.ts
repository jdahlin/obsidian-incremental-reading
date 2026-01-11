/**
 * Model Hydration and Markdown Generation
 *
 * Converts raw database rows to typed Model objects and generates
 * markdown files for the IR/Anki-Import/Models/ directory.
 */

import type Database from 'better-sqlite3'
import type { ModelField, ModelFrontmatter, ModelTemplate } from './ir-types.js'
import type { Field, FieldRow, Model, NotetypeRow, Template, TemplateRow } from './types.js'
import { stringify as yamlStringify } from 'yaml'
import { readFields, readNotetypes, readTemplates } from './database.js'
import { sanitizeFilename } from './ir-types.js'
import { fieldOrd, modelId, NotetypeKind, parseTemplateConfig, templateOrd } from './types.js'

// =============================================================================
// Notetype Kind Detection
// =============================================================================

/**
 * Detect notetype kind from config blob
 *
 * The config column contains a Protobuf-encoded NotetypeConfig message.
 * We look for the kind field which indicates normal (0) or cloze (1).
 *
 * For simplicity, we use heuristics based on template count and names:
 * - Single template named "Cloze" or containing cloze syntax → Cloze
 * - Otherwise → Normal
 */
export function detectNotetypeKind(
	notetype: NotetypeRow,
	templates: TemplateRow[],
): typeof NotetypeKind.Normal | typeof NotetypeKind.Cloze {
	// Heuristic: Cloze notetypes typically have a single template
	// with "cloze" in the name (case-insensitive)
	if (templates.length === 1) {
		const templateName = templates[0]?.name.toLowerCase() ?? ''
		if (templateName.includes('cloze')) {
			return NotetypeKind.Cloze
		}
	}

	// Could parse the protobuf config for definitive answer,
	// but this heuristic works for standard Anki notetypes
	return NotetypeKind.Normal
}

/**
 * Check if notetype is an Image Occlusion type
 * These have specific field names like "Occlusion", "Image"
 */
export function isImageOcclusionNotetype(fields: FieldRow[]): boolean {
	const fieldNames = fields.map((f) => f.name.toLowerCase())
	return fieldNames.includes('occlusion') && fieldNames.includes('image')
}

// =============================================================================
// Model Hydration
// =============================================================================

/**
 * Convert raw field row to hydrated Field
 */
export function hydrateField(row: FieldRow): Field {
	return {
		name: row.name,
		ord: fieldOrd(row.ord),
	}
}

/**
 * Convert raw template row to hydrated Template
 */
export function hydrateTemplate(row: TemplateRow): Template {
	const config = parseTemplateConfig(row.config)
	return {
		name: row.name,
		ord: templateOrd(row.ord),
		qfmt: config.qfmt,
		afmt: config.afmt,
	}
}

/**
 * Convert raw notetype row and related data to hydrated Model
 */
export function hydrateModel(
	notetypeRow: NotetypeRow,
	fieldRows: FieldRow[],
	templateRows: TemplateRow[],
): Model {
	const fields = fieldRows.map(hydrateField)
	const templates = templateRows.map(hydrateTemplate)
	const kind = detectNotetypeKind(notetypeRow, templateRows)

	return {
		id: modelId(notetypeRow.id),
		name: notetypeRow.name,
		kind,
		fields,
		templates,
	}
}

/**
 * Read all models from database with their fields and templates
 */
export function readAllModels(db: Database.Database): Model[] {
	const notetypes = readNotetypes(db)
	const allFields = readFields(db)
	const allTemplates = readTemplates(db)

	// Group fields and templates by notetype ID
	const fieldsByNtid = new Map<number, FieldRow[]>()
	for (const field of allFields) {
		const existing = fieldsByNtid.get(field.ntid) ?? []
		existing.push(field)
		fieldsByNtid.set(field.ntid, existing)
	}

	const templatesByNtid = new Map<number, TemplateRow[]>()
	for (const template of allTemplates) {
		const existing = templatesByNtid.get(template.ntid) ?? []
		existing.push(template)
		templatesByNtid.set(template.ntid, existing)
	}

	return notetypes.map((nt) =>
		hydrateModel(
			nt,
			fieldsByNtid.get(nt.id) ?? [],
			templatesByNtid.get(nt.id) ?? [],
		),
	)
}

// =============================================================================
// Markdown Generation
// =============================================================================

/**
 * Convert Model to markdown file content
 */
export function modelToMarkdown(model: Model): string {
	const frontmatter: ModelFrontmatter = {
		anki_model_id: String(model.id),
		name: model.name,
		fields: model.fields.map(
			(f): ModelField => ({
				name: f.name,
				ord: f.ord,
			}),
		),
		templates: model.templates.map(
			(t): ModelTemplate => ({
				name: t.name,
				ord: t.ord,
				qfmt: t.qfmt,
				afmt: t.afmt,
			}),
		),
	}

	const yaml = yamlStringify(frontmatter, {
		indent: 2,
		lineWidth: 0, // Don't wrap lines
	})

	// Frontmatter only - body content would duplicate the structured data
	return `---
${yaml}---
`
}

/**
 * Get the filename for a model
 */
export function getModelFilename(model: Model): string {
	return `${sanitizeFilename(model.name)}.md`
}

// =============================================================================
// Export Results
// =============================================================================

/**
 * Result of exporting a single model
 */
export interface ExportedModelFile {
	readonly model: Model
	readonly filename: string
	readonly content: string
}

/**
 * Export all models to markdown file contents
 * (Does not write to filesystem - that's the caller's responsibility)
 */
export function exportModelsToMarkdown(models: Model[]): ExportedModelFile[] {
	return models.map((model) => ({
		model,
		filename: getModelFilename(model),
		content: modelToMarkdown(model),
	}))
}

/**
 * Summary of model export
 */
export interface ModelExportSummary {
	readonly totalModels: number
	readonly normalModels: number
	readonly clozeModels: number
	readonly imageOcclusionModels: number
	readonly models: ExportedModelFile[]
}

/**
 * Export all models from database with summary
 */
export function exportAllModels(db: Database.Database): ModelExportSummary {
	const models = readAllModels(db)
	const allFields = readFields(db)

	// Group fields by notetype for IO detection
	const fieldsByNtid = new Map<number, FieldRow[]>()
	for (const field of allFields) {
		const existing = fieldsByNtid.get(field.ntid) ?? []
		existing.push(field)
		fieldsByNtid.set(field.ntid, existing)
	}

	let normalCount = 0
	let clozeCount = 0
	let ioCount = 0

	for (const model of models) {
		const fields = fieldsByNtid.get(model.id as number) ?? []
		if (isImageOcclusionNotetype(fields)) {
			ioCount++
		} else if (model.kind === NotetypeKind.Cloze) {
			clozeCount++
		} else {
			normalCount++
		}
	}

	return {
		totalModels: models.length,
		normalModels: normalCount,
		clozeModels: clozeCount,
		imageOcclusionModels: ioCount,
		models: exportModelsToMarkdown(models),
	}
}
