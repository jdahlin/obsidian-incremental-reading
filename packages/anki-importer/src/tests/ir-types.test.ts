import { describe, expect, it } from 'vitest'
import {
	deckNameToPath,
	factorToDifficulty,
	generateClozeUid,
	generateIRNoteId,
	isBasicSidecar,
	isClozeIndex,
	isClozeSidecar,
	isNoteType,
	isSchedulingStatus,
	isTopicSidecar,
	isValidDifficulty,
	isValidIRNoteId,
	isValidPriority,
	NoteType,
	pathToDeckSegments,
	sanitizeFilename,
	SchedulingStatus,
} from '../ir-types.js'
import type { SidecarFrontmatter } from '../ir-types.js'

describe('ID Generation', () => {
	describe('generateIRNoteId', () => {
		it('generates 12-character IDs', () => {
			const id = generateIRNoteId()
			expect(id).toHaveLength(12)
		})

		it('generates alphanumeric IDs', () => {
			const id = generateIRNoteId()
			expect(/^[A-Za-z0-9]{12}$/.test(id)).toBe(true)
		})

		it('generates unique IDs', () => {
			const ids = new Set<string>()
			for (let i = 0; i < 100; i++) {
				ids.add(generateIRNoteId())
			}
			expect(ids.size).toBe(100)
		})
	})

	describe('generateClozeUid', () => {
		it('generates 12-character IDs', () => {
			const id = generateClozeUid()
			expect(id).toHaveLength(12)
		})

		it('generates unique IDs', () => {
			const ids = new Set<string>()
			for (let i = 0; i < 100; i++) {
				ids.add(generateClozeUid())
			}
			expect(ids.size).toBe(100)
		})
	})
})

describe('Validation', () => {
	describe('isValidIRNoteId', () => {
		it('validates correct format', () => {
			expect(isValidIRNoteId('H4573WdOw2q0')).toBe(true)
			expect(isValidIRNoteId('abcdefghijkl')).toBe(true)
			expect(isValidIRNoteId('123456789012')).toBe(true)
		})

		it('rejects wrong length', () => {
			expect(isValidIRNoteId('abc')).toBe(false)
			expect(isValidIRNoteId('abcdefghijklm')).toBe(false)
		})

		it('rejects non-alphanumeric', () => {
			expect(isValidIRNoteId('abc-def_ghij')).toBe(false)
			expect(isValidIRNoteId('abc def ghij')).toBe(false)
		})
	})

	describe('isValidPriority', () => {
		it('accepts valid range 0-100', () => {
			expect(isValidPriority(0)).toBe(true)
			expect(isValidPriority(50)).toBe(true)
			expect(isValidPriority(100)).toBe(true)
		})

		it('rejects out of range', () => {
			expect(isValidPriority(-1)).toBe(false)
			expect(isValidPriority(101)).toBe(false)
		})

		it('rejects non-integers', () => {
			expect(isValidPriority(50.5)).toBe(false)
		})
	})

	describe('isValidDifficulty', () => {
		it('accepts valid range 0-10', () => {
			expect(isValidDifficulty(0)).toBe(true)
			expect(isValidDifficulty(5)).toBe(true)
			expect(isValidDifficulty(10)).toBe(true)
		})

		it('accepts decimals in range', () => {
			expect(isValidDifficulty(3.5)).toBe(true)
		})

		it('rejects out of range', () => {
			expect(isValidDifficulty(-0.1)).toBe(false)
			expect(isValidDifficulty(10.1)).toBe(false)
		})
	})
})

describe('Type Guards', () => {
	describe('isSchedulingStatus', () => {
		it('returns true for valid statuses', () => {
			expect(isSchedulingStatus('new')).toBe(true)
			expect(isSchedulingStatus('learning')).toBe(true)
			expect(isSchedulingStatus('review')).toBe(true)
			expect(isSchedulingStatus('relearning')).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isSchedulingStatus('unknown')).toBe(false)
			expect(isSchedulingStatus('')).toBe(false)
		})
	})

	describe('isNoteType', () => {
		it('returns true for valid types', () => {
			expect(isNoteType('basic')).toBe(true)
			expect(isNoteType('cloze')).toBe(true)
			expect(isNoteType('image_occlusion')).toBe(true)
			expect(isNoteType('standard')).toBe(true)
			expect(isNoteType('topic')).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isNoteType('unknown')).toBe(false)
		})
	})

	describe('isClozeIndex', () => {
		it('returns true for valid cloze indices', () => {
			expect(isClozeIndex('c1')).toBe(true)
			expect(isClozeIndex('c2')).toBe(true)
			expect(isClozeIndex('c10')).toBe(true)
			expect(isClozeIndex('c999')).toBe(true)
		})

		it('returns false for c0', () => {
			expect(isClozeIndex('c0')).toBe(false)
		})

		it('returns false for invalid formats', () => {
			expect(isClozeIndex('1')).toBe(false)
			expect(isClozeIndex('C1')).toBe(false)
			expect(isClozeIndex('cloze1')).toBe(false)
		})
	})

	describe('Sidecar type guards', () => {
		const basicSidecar: SidecarFrontmatter = {
			ir_note_id: 'abc123def456',
			note_path: 'Anki/Test/123.md',
			priority: 50,
			type: 'basic',
			basic: {
				status: SchedulingStatus.New,
				due: '2026-01-11T00:00:00.000Z',
				stability: 0,
				difficulty: 5,
				reps: 0,
				lapses: 0,
				lastReview: null,
			},
		}

		const clozeSidecar: SidecarFrontmatter = {
			ir_note_id: 'abc123def456',
			note_path: 'Anki/Test/123.md',
			priority: 50,
			type: 'cloze',
			clozes: {
				c1: {
					clozeUid: 'uid123456789' as never,
					status: SchedulingStatus.New,
					due: '2026-01-11T00:00:00.000Z',
					stability: 0,
					difficulty: 5,
					reps: 0,
					lapses: 0,
					lastReview: null,
				},
			},
		}

		const topicSidecar: SidecarFrontmatter = {
			ir_note_id: 'abc123def456',
			note_path: 'Notes/Topic.md',
			priority: 50,
			type: 'topic',
			topic: {
				status: SchedulingStatus.New,
				due: '2026-01-11T00:00:00.000Z',
				stability: 0,
				difficulty: 5,
				reps: 0,
				lapses: 0,
				lastReview: null,
			},
		}

		it('isBasicSidecar identifies basic type', () => {
			expect(isBasicSidecar(basicSidecar)).toBe(true)
			expect(isBasicSidecar(clozeSidecar)).toBe(false)
			expect(isBasicSidecar(topicSidecar)).toBe(false)
		})

		it('isClozeSidecar identifies cloze and image_occlusion types', () => {
			expect(isClozeSidecar(clozeSidecar)).toBe(true)
			expect(isClozeSidecar(basicSidecar)).toBe(false)
			expect(isClozeSidecar(topicSidecar)).toBe(false)
		})

		it('isTopicSidecar identifies topic type', () => {
			expect(isTopicSidecar(topicSidecar)).toBe(true)
			expect(isTopicSidecar(basicSidecar)).toBe(false)
			expect(isTopicSidecar(clozeSidecar)).toBe(false)
		})
	})
})

describe('Conversion Helpers', () => {
	describe('factorToDifficulty', () => {
		it('converts Anki factor to FSRS difficulty', () => {
			// Formula: (3000 - clamp(factor, 1300, 3000)) / 170
			// factor 2500 → (3000 - 2500) / 170 = 500/170 ≈ 2.94
			expect(factorToDifficulty(2500)).toBeCloseTo(2.94, 1)
		})

		it('clamps low factors to 1300', () => {
			// factor 1000 → clamped to 1300 → (3000 - 1300) / 170 = 10
			expect(factorToDifficulty(1000)).toBe(10)
			expect(factorToDifficulty(1300)).toBe(10)
		})

		it('clamps high factors to 3000', () => {
			// factor 3500 → clamped to 3000 → (3000 - 3000) / 170 = 0
			expect(factorToDifficulty(3500)).toBe(0)
			expect(factorToDifficulty(3000)).toBe(0)
		})

		it('produces values in 0-10 range', () => {
			for (const factor of [1000, 1300, 1500, 2000, 2500, 3000, 3500]) {
				const diff = factorToDifficulty(factor)
				expect(diff).toBeGreaterThanOrEqual(0)
				expect(diff).toBeLessThanOrEqual(10)
			}
		})
	})
})

describe('Path Utilities', () => {
	describe('sanitizeFilename', () => {
		it('replaces unsafe characters', () => {
			expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_________name')
		})

		it('preserves spaces and parentheses', () => {
			expect(sanitizeFilename('Basic (and reversed card)')).toBe(
				'Basic (and reversed card)',
			)
		})

		it('trims whitespace', () => {
			expect(sanitizeFilename('  name  ')).toBe('name')
		})
	})

	describe('deckNameToPath', () => {
		it('converts Anki deck hierarchy to filesystem path', () => {
			expect(deckNameToPath('Parent::Child::Grandchild')).toBe(
				'Parent/Child/Grandchild',
			)
		})

		it('handles single segment', () => {
			expect(deckNameToPath('Default')).toBe('Default')
		})

		it('sanitizes unsafe characters in segments', () => {
			expect(deckNameToPath('Parent::Child?')).toBe('Parent/Child_')
		})
	})

	describe('pathToDeckSegments', () => {
		it('splits path into segments', () => {
			expect(pathToDeckSegments('Parent/Child/Grandchild')).toEqual([
				'Parent',
				'Child',
				'Grandchild',
			])
		})

		it('filters empty segments', () => {
			expect(pathToDeckSegments('Parent//Child')).toEqual(['Parent', 'Child'])
		})

		it('handles single segment', () => {
			expect(pathToDeckSegments('Default')).toEqual(['Default'])
		})
	})
})

describe('Constants', () => {
	it('SchedulingStatus has correct values', () => {
		expect(SchedulingStatus.New).toBe('new')
		expect(SchedulingStatus.Learning).toBe('learning')
		expect(SchedulingStatus.Review).toBe('review')
		expect(SchedulingStatus.Relearning).toBe('relearning')
	})

	it('NoteType has correct values', () => {
		expect(NoteType.Basic).toBe('basic')
		expect(NoteType.Cloze).toBe('cloze')
		expect(NoteType.ImageOcclusion).toBe('image_occlusion')
		expect(NoteType.Standard).toBe('standard')
		expect(NoteType.Topic).toBe('topic')
	})
})
