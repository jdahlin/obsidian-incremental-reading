/**
 * Model Importer
 *
 * Reads notetypes, fields, and templates from Anki database.
 */

import type Database from 'better-sqlite3'
import type { DeepReadonly } from '../readonly.js'
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
function detectNotetypeKind(
	notetype: DeepReadonly<NotetypeRow>,
	templates: readonly DeepReadonly<TemplateRow>[],
): typeof NotetypeKind.Normal | typeof NotetypeKind.Cloze {
	if (templates.length === 1) {
		const templateName = templates[0]?.name.toLowerCase() ?? ''
		if (templateName.includes('cloze')) {
			return NotetypeKind.Cloze
		}
	}
	return NotetypeKind.Normal
}

// =============================================================================
// Hydration Functions
// =============================================================================

/**
 * Convert raw field row to hydrated Field
 */
function hydrateField(row: DeepReadonly<FieldRow>): Field {
	return {
		name: row.name,
		ord: fieldOrd(row.ord),
	}
}

/**
 * Convert raw template row to hydrated Template
 */
function hydrateTemplate(row: DeepReadonly<TemplateRow>): Template {
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
function hydrateModel(
	notetypeRow: DeepReadonly<NotetypeRow>,
	fieldRows: readonly DeepReadonly<FieldRow>[],
	templateRows: readonly DeepReadonly<TemplateRow>[],
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
export function importModels(db: DeepReadonly<Database.Database>): Model[] {
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
		hydrateModel(nt, fieldsByNtid.get(nt.id) ?? [], templatesByNtid.get(nt.id) ?? []),
	)
}
