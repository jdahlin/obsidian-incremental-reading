import { describe, expect, it } from 'vitest'
import type { Model, FieldRow, TemplateRow, NotetypeRow } from '../types.js'
import { fieldOrd, modelId, NotetypeKind, templateOrd, parseTemplateConfig } from '../types.js'
import {
	detectNotetypeKind,
	exportModelsToMarkdown,
	getModelFilename,
	hydrateField,
	hydrateModel,
	hydrateTemplate,
	isImageOcclusionNotetype,
	modelToMarkdown,
} from '../models.js'

/**
 * Create a template config protobuf for testing
 * Encodes qfmt (field 1) and afmt (field 2) as length-delimited strings
 */
function createTemplateConfig(qfmt: string, afmt: string): Uint8Array {
	const encoder = new TextEncoder()
	const qfmtBytes = encoder.encode(qfmt)
	const afmtBytes = encoder.encode(afmt)

	// Calculate size: tag + length varint + content for each field
	const parts: number[] = []

	// Field 1: qfmt (tag = 0x0A = field 1, wire type 2)
	parts.push(0x0a)
	// Length as varint (simple case: < 128 bytes)
	if (qfmtBytes.length < 128) {
		parts.push(qfmtBytes.length)
	} else {
		// Multi-byte varint
		let len = qfmtBytes.length
		while (len >= 128) {
			parts.push((len & 0x7f) | 0x80)
			len >>>= 7
		}
		parts.push(len)
	}
	for (const b of qfmtBytes) parts.push(b)

	// Field 2: afmt (tag = 0x12 = field 2, wire type 2)
	parts.push(0x12)
	if (afmtBytes.length < 128) {
		parts.push(afmtBytes.length)
	} else {
		let len = afmtBytes.length
		while (len >= 128) {
			parts.push((len & 0x7f) | 0x80)
			len >>>= 7
		}
		parts.push(len)
	}
	for (const b of afmtBytes) parts.push(b)

	return new Uint8Array(parts)
}

describe('parseTemplateConfig', () => {
	it('parses qfmt and afmt from protobuf', () => {
		const config = createTemplateConfig('{{Front}}', '{{FrontSide}}<hr>{{Back}}')
		const result = parseTemplateConfig(config)
		expect(result.qfmt).toBe('{{Front}}')
		expect(result.afmt).toBe('{{FrontSide}}<hr>{{Back}}')
	})

	it('handles empty config', () => {
		const result = parseTemplateConfig(new Uint8Array())
		expect(result.qfmt).toBe('')
		expect(result.afmt).toBe('')
	})

	it('handles complex template with HTML and JS', () => {
		const qfmt = '{{#Header}}<div>{{Header}}</div>{{/Header}}'
		const afmt = '<script>anki.imageOcclusion.setup();</script>{{Image}}'
		const config = createTemplateConfig(qfmt, afmt)
		const result = parseTemplateConfig(config)
		expect(result.qfmt).toBe(qfmt)
		expect(result.afmt).toBe(afmt)
	})
})

describe('Notetype Kind Detection', () => {
	const baseNotetype: NotetypeRow = {
		id: 1234567890123,
		name: 'Test',
		mtime_secs: 0,
		usn: 0,
		config: new Uint8Array(),
	}

	describe('detectNotetypeKind', () => {
		it('detects cloze notetype from template name', () => {
			const templates: TemplateRow[] = [
				{
					ntid: 1,
					ord: 0,
					name: 'Cloze',
					mtime_secs: 0,
					usn: 0,
					config: new Uint8Array(),
				},
			]
			expect(detectNotetypeKind(baseNotetype, templates)).toBe(NotetypeKind.Cloze)
		})

		it('detects cloze from case-insensitive match', () => {
			const templates: TemplateRow[] = [
				{
					ntid: 1,
					ord: 0,
					name: 'CLOZE CARD',
					mtime_secs: 0,
					usn: 0,
					config: new Uint8Array(),
				},
			]
			expect(detectNotetypeKind(baseNotetype, templates)).toBe(NotetypeKind.Cloze)
		})

		it('returns normal for multiple templates', () => {
			const templates: TemplateRow[] = [
				{
					ntid: 1,
					ord: 0,
					name: 'Card 1',
					mtime_secs: 0,
					usn: 0,
					config: new Uint8Array(),
				},
				{
					ntid: 1,
					ord: 1,
					name: 'Card 2',
					mtime_secs: 0,
					usn: 0,
					config: new Uint8Array(),
				},
			]
			expect(detectNotetypeKind(baseNotetype, templates)).toBe(NotetypeKind.Normal)
		})

		it('returns normal for non-cloze single template', () => {
			const templates: TemplateRow[] = [
				{
					ntid: 1,
					ord: 0,
					name: 'Card 1',
					mtime_secs: 0,
					usn: 0,
					config: new Uint8Array(),
				},
			]
			expect(detectNotetypeKind(baseNotetype, templates)).toBe(NotetypeKind.Normal)
		})
	})

	describe('isImageOcclusionNotetype', () => {
		it('returns true for IO fields', () => {
			const fields: FieldRow[] = [
				{ ntid: 1, ord: 0, name: 'Occlusion', config: new Uint8Array() },
				{ ntid: 1, ord: 1, name: 'Image', config: new Uint8Array() },
				{ ntid: 1, ord: 2, name: 'Header', config: new Uint8Array() },
			]
			expect(isImageOcclusionNotetype(fields)).toBe(true)
		})

		it('returns true for case-insensitive match', () => {
			const fields: FieldRow[] = [
				{ ntid: 1, ord: 0, name: 'OCCLUSION', config: new Uint8Array() },
				{ ntid: 1, ord: 1, name: 'IMAGE', config: new Uint8Array() },
			]
			expect(isImageOcclusionNotetype(fields)).toBe(true)
		})

		it('returns false for missing fields', () => {
			const fields: FieldRow[] = [
				{ ntid: 1, ord: 0, name: 'Front', config: new Uint8Array() },
				{ ntid: 1, ord: 1, name: 'Back', config: new Uint8Array() },
			]
			expect(isImageOcclusionNotetype(fields)).toBe(false)
		})
	})
})

describe('Model Hydration', () => {
	describe('hydrateField', () => {
		it('converts FieldRow to Field', () => {
			const row: FieldRow = {
				ntid: 1,
				ord: 0,
				name: 'Front',
				config: new Uint8Array(),
			}
			const field = hydrateField(row)
			expect(field.name).toBe('Front')
			expect(field.ord).toBe(0)
		})
	})

	describe('hydrateTemplate', () => {
		it('converts TemplateRow to Template', () => {
			const row: TemplateRow = {
				ntid: 1,
				ord: 0,
				name: 'Card 1',
				mtime_secs: 0,
				usn: 0,
				config: createTemplateConfig('{{Front}}', '{{Back}}'),
			}
			const template = hydrateTemplate(row)
			expect(template.name).toBe('Card 1')
			expect(template.ord).toBe(0)
			expect(template.qfmt).toBe('{{Front}}')
			expect(template.afmt).toBe('{{Back}}')
		})
	})

	describe('hydrateModel', () => {
		it('combines notetype, fields, and templates', () => {
			const notetype: NotetypeRow = {
				id: 1234567890123,
				name: 'Basic',
				mtime_secs: 0,
				usn: 0,
				config: new Uint8Array(),
			}
			const fields: FieldRow[] = [
				{ ntid: 1234567890123, ord: 0, name: 'Front', config: new Uint8Array() },
				{ ntid: 1234567890123, ord: 1, name: 'Back', config: new Uint8Array() },
			]
			const templates: TemplateRow[] = [
				{
					ntid: 1234567890123,
					ord: 0,
					name: 'Card 1',
					mtime_secs: 0,
					usn: 0,
					config: createTemplateConfig('{{Front}}', '{{Back}}'),
				},
			]

			const model = hydrateModel(notetype, fields, templates)

			expect(model.id).toBe(1234567890123)
			expect(model.name).toBe('Basic')
			expect(model.kind).toBe(NotetypeKind.Normal)
			expect(model.fields).toHaveLength(2)
			expect(model.templates).toHaveLength(1)
			expect(model.templates[0]?.qfmt).toBe('{{Front}}')
			expect(model.templates[0]?.afmt).toBe('{{Back}}')
		})
	})
})

describe('Markdown Generation', () => {
	const basicModel: Model = {
		id: modelId(1234567890123),
		name: 'Basic',
		kind: NotetypeKind.Normal,
		fields: [
			{ name: 'Front', ord: fieldOrd(0) },
			{ name: 'Back', ord: fieldOrd(1) },
		],
		templates: [{
			name: 'Card 1',
			ord: templateOrd(0),
			qfmt: '{{Front}}',
			afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
		}],
	}

	const clozeModel: Model = {
		id: modelId(1234567890124),
		name: 'Cloze',
		kind: NotetypeKind.Cloze,
		fields: [
			{ name: 'Text', ord: fieldOrd(0) },
			{ name: 'Back Extra', ord: fieldOrd(1) },
		],
		templates: [{
			name: 'Cloze',
			ord: templateOrd(0),
			qfmt: '{{cloze:Text}}',
			afmt: '{{cloze:Text}}<br>{{Back Extra}}',
		}],
	}

	describe('modelToMarkdown', () => {
		it('generates valid frontmatter', () => {
			const md = modelToMarkdown(basicModel)

			expect(md).toContain('---')
			expect(md).toContain('anki_model_id: "1234567890123"')
			expect(md).toContain('name: Basic')
		})

		it('includes fields in frontmatter', () => {
			const md = modelToMarkdown(basicModel)

			expect(md).toContain('fields:')
			expect(md).toContain('name: Front')
			expect(md).toContain('ord: 0')
			expect(md).toContain('name: Back')
			expect(md).toContain('ord: 1')
		})

		it('includes templates in frontmatter', () => {
			const md = modelToMarkdown(basicModel)

			expect(md).toContain('templates:')
			expect(md).toContain('name: Card 1')
		})

		it('includes template qfmt and afmt', () => {
			const md = modelToMarkdown(basicModel)

			expect(md).toContain('qfmt: "{{Front}}"')
			expect(md).toContain('afmt: "{{FrontSide}}<hr id=answer>{{Back}}"')
		})

		it('contains only frontmatter (no body)', () => {
			const md = modelToMarkdown(basicModel)
			// File should end with closing frontmatter delimiter and newline
			expect(md).toMatch(/---\n$/)
			// Should not contain body elements
			expect(md).not.toContain('# Basic')
			expect(md).not.toContain('## Fields')
			expect(md).not.toContain('## Templates')
		})
	})

	describe('getModelFilename', () => {
		it('uses model name as filename', () => {
			expect(getModelFilename(basicModel)).toBe('Basic.md')
		})

		it('sanitizes unsafe characters', () => {
			const model: Model = {
				...basicModel,
				name: 'Basic/Reversed',
			}
			expect(getModelFilename(model)).toBe('Basic_Reversed.md')
		})

		it('preserves spaces and parentheses', () => {
			const model: Model = {
				...basicModel,
				name: 'Basic (and reversed card)',
			}
			expect(getModelFilename(model)).toBe('Basic (and reversed card).md')
		})
	})

	describe('exportModelsToMarkdown', () => {
		it('exports all models', () => {
			const result = exportModelsToMarkdown([basicModel, clozeModel])

			expect(result).toHaveLength(2)
			expect(result[0]?.filename).toBe('Basic.md')
			expect(result[1]?.filename).toBe('Cloze.md')
		})

		it('includes model and content in result', () => {
			const result = exportModelsToMarkdown([basicModel])

			expect(result[0]?.model).toBe(basicModel)
			expect(result[0]?.content).toContain('name: Basic')
		})
	})
})
