/**
 * Model Importer
 *
 * Reads notetypes, fields, and templates from Anki database.
 */

import type Database from 'better-sqlite3'
import type { Field, FieldRow, Model, NotetypeRow, Template, TemplateRow } from '../types.js'
import { readFields, readNotetypes, readTemplates } from '../database.js'
import { fieldOrd, modelId, NotetypeKind, parseTemplateConfig, templateOrd } from '../types.js'

// =============================================================================
// Notetype Kind Detection
// =============================================================================

/**
 * Detect notetype kind from templates
 *
 * Heuristic: Cloze notetypes typically have a single template
 * with "cloze" in the name (case-insensitive)
 */
export function detectNotetypeKind(
	notetype: NotetypeRow,
	templates: TemplateRow[],
): typeof NotetypeKind.Normal | typeof NotetypeKind.Cloze {
	if (templates.length === 1) {
		const templateName = templates[0]?.name.toLowerCase() ?? ''
		if (templateName.includes('cloze')) {
			return NotetypeKind.Cloze
		}
	}
	return NotetypeKind.Normal
}

/**
 * Check if notetype is an Image Occlusion type
 */
export function isImageOcclusionNotetype(fields: FieldRow[]): boolean {
	const fieldNames = fields.map((f) => f.name.toLowerCase())
	return fieldNames.includes('occlusion') && fieldNames.includes('image')
}

// =============================================================================
// Hydration Functions
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

// =============================================================================
// Import Function
// =============================================================================

/**
 * Import all models from database
 */
export function importModels(db: Database.Database): Model[] {
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
