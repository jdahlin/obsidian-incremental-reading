import { describe, expect, it } from 'vitest'
import {
	CardQueue,
	CardType,
	cardId,
	cardOrd,
	deckId,
	decodeLeft,
	DECK_SEPARATOR,
	EaseButton,
	fieldOrd,
	FIELD_SEPARATOR,
	isCardQueue,
	isCardType,
	isEaseButton,
	isNotetypeKind,
	isRevlogKind,
	isValidQueueTypeCombo,
	modelId,
	noteId,
	NotetypeKind,
	parseDeckPath,
	parseFieldValues,
	parseTags,
	RevlogKind,
	templateOrd,
} from '../types.js'

describe('Branded Types', () => {
	describe('modelId', () => {
		it('accepts valid positive integers', () => {
			expect(modelId(123456789)).toBe(123456789)
			expect(modelId(1)).toBe(1)
		})

		it('throws for zero', () => {
			expect(() => modelId(0)).toThrow('Invalid ModelId')
		})

		it('throws for negative numbers', () => {
			expect(() => modelId(-1)).toThrow('Invalid ModelId')
		})

		it('throws for non-integers', () => {
			expect(() => modelId(1.5)).toThrow('Invalid ModelId')
		})
	})

	describe('noteId', () => {
		it('accepts valid positive integers', () => {
			expect(noteId(1234567890123)).toBe(1234567890123)
		})

		it('throws for invalid values', () => {
			expect(() => noteId(0)).toThrow('Invalid NoteId')
			expect(() => noteId(-1)).toThrow('Invalid NoteId')
		})
	})

	describe('cardId', () => {
		it('accepts valid positive integers', () => {
			expect(cardId(1234567890123)).toBe(1234567890123)
		})

		it('throws for invalid values', () => {
			expect(() => cardId(0)).toThrow('Invalid CardId')
		})
	})

	describe('deckId', () => {
		it('accepts valid positive integers including 1 (default deck)', () => {
			expect(deckId(1)).toBe(1)
			expect(deckId(1234567890)).toBe(1234567890)
		})

		it('throws for invalid values', () => {
			expect(() => deckId(0)).toThrow('Invalid DeckId')
		})
	})

	describe('fieldOrd', () => {
		it('accepts valid non-negative integers', () => {
			expect(fieldOrd(0)).toBe(0)
			expect(fieldOrd(10)).toBe(10)
		})

		it('throws for negative values', () => {
			expect(() => fieldOrd(-1)).toThrow('Invalid FieldOrd')
		})
	})

	describe('templateOrd', () => {
		it('accepts valid non-negative integers', () => {
			expect(templateOrd(0)).toBe(0)
			expect(templateOrd(5)).toBe(5)
		})

		it('throws for negative values', () => {
			expect(() => templateOrd(-1)).toThrow('Invalid TemplateOrd')
		})
	})

	describe('cardOrd', () => {
		it('accepts valid non-negative integers', () => {
			expect(cardOrd(0)).toBe(0)
			expect(cardOrd(3)).toBe(3)
		})

		it('throws for negative values', () => {
			expect(() => cardOrd(-1)).toThrow('Invalid CardOrd')
		})
	})
})

describe('Enums', () => {
	describe('CardQueue', () => {
		it('has correct values', () => {
			expect(CardQueue.UserBuried).toBe(-3)
			expect(CardQueue.SchedBuried).toBe(-2)
			expect(CardQueue.Suspended).toBe(-1)
			expect(CardQueue.New).toBe(0)
			expect(CardQueue.Learning).toBe(1)
			expect(CardQueue.Review).toBe(2)
			expect(CardQueue.DayLearn).toBe(3)
			expect(CardQueue.Preview).toBe(4)
		})
	})

	describe('CardType', () => {
		it('has correct values', () => {
			expect(CardType.New).toBe(0)
			expect(CardType.Learn).toBe(1)
			expect(CardType.Review).toBe(2)
			expect(CardType.Relearn).toBe(3)
		})
	})

	describe('NotetypeKind', () => {
		it('has correct values', () => {
			expect(NotetypeKind.Normal).toBe(0)
			expect(NotetypeKind.Cloze).toBe(1)
		})
	})

	describe('RevlogKind', () => {
		it('has correct values', () => {
			expect(RevlogKind.Learning).toBe(0)
			expect(RevlogKind.Review).toBe(1)
			expect(RevlogKind.Relearning).toBe(2)
			expect(RevlogKind.Filtered).toBe(3)
			expect(RevlogKind.Manual).toBe(4)
			expect(RevlogKind.Rescheduled).toBe(5)
		})
	})

	describe('EaseButton', () => {
		it('has correct values', () => {
			expect(EaseButton.Manual).toBe(0)
			expect(EaseButton.Again).toBe(1)
			expect(EaseButton.Hard).toBe(2)
			expect(EaseButton.Good).toBe(3)
			expect(EaseButton.Easy).toBe(4)
		})
	})
})

describe('Type Guards', () => {
	describe('isCardQueue', () => {
		it('returns true for valid queue values', () => {
			expect(isCardQueue(-3)).toBe(true)
			expect(isCardQueue(0)).toBe(true)
			expect(isCardQueue(4)).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isCardQueue(-4)).toBe(false)
			expect(isCardQueue(5)).toBe(false)
		})
	})

	describe('isCardType', () => {
		it('returns true for valid type values', () => {
			expect(isCardType(0)).toBe(true)
			expect(isCardType(3)).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isCardType(-1)).toBe(false)
			expect(isCardType(4)).toBe(false)
		})
	})

	describe('isNotetypeKind', () => {
		it('returns true for valid kinds', () => {
			expect(isNotetypeKind(0)).toBe(true)
			expect(isNotetypeKind(1)).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isNotetypeKind(-1)).toBe(false)
			expect(isNotetypeKind(2)).toBe(false)
		})
	})

	describe('isEaseButton', () => {
		it('returns true for valid button values', () => {
			expect(isEaseButton(0)).toBe(true)
			expect(isEaseButton(4)).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isEaseButton(-1)).toBe(false)
			expect(isEaseButton(5)).toBe(false)
		})
	})

	describe('isRevlogKind', () => {
		it('returns true for valid kinds', () => {
			expect(isRevlogKind(0)).toBe(true)
			expect(isRevlogKind(5)).toBe(true)
		})

		it('returns false for invalid values', () => {
			expect(isRevlogKind(-1)).toBe(false)
			expect(isRevlogKind(6)).toBe(false)
		})
	})
})

describe('Validation Helpers', () => {
	describe('isValidQueueTypeCombo', () => {
		it('validates New queue with New type', () => {
			expect(isValidQueueTypeCombo(CardQueue.New, CardType.New)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.New, CardType.Review)).toBe(false)
		})

		it('validates Learning queue with Learn/Relearn types', () => {
			expect(isValidQueueTypeCombo(CardQueue.Learning, CardType.Learn)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.Learning, CardType.Relearn)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.Learning, CardType.New)).toBe(false)
		})

		it('validates DayLearn queue with Learn/Relearn types', () => {
			expect(isValidQueueTypeCombo(CardQueue.DayLearn, CardType.Learn)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.DayLearn, CardType.Relearn)).toBe(true)
		})

		it('validates Review queue with Review type', () => {
			expect(isValidQueueTypeCombo(CardQueue.Review, CardType.Review)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.Review, CardType.New)).toBe(false)
		})

		it('allows any type for Suspended/Buried queues', () => {
			expect(isValidQueueTypeCombo(CardQueue.Suspended, CardType.New)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.Suspended, CardType.Review)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.UserBuried, CardType.Learn)).toBe(true)
			expect(isValidQueueTypeCombo(CardQueue.SchedBuried, CardType.Relearn)).toBe(true)
		})
	})
})

describe('Parsing Helpers', () => {
	describe('parseFieldValues', () => {
		it('splits by field separator', () => {
			expect(parseFieldValues('front\x1fback')).toEqual(['front', 'back'])
			expect(parseFieldValues('a\x1fb\x1fc')).toEqual(['a', 'b', 'c'])
		})

		it('handles single field', () => {
			expect(parseFieldValues('only one')).toEqual(['only one'])
		})

		it('handles empty fields', () => {
			expect(parseFieldValues('\x1f\x1f')).toEqual(['', '', ''])
		})

		it('preserves HTML in fields', () => {
			expect(parseFieldValues('<b>bold</b>\x1f<i>italic</i>')).toEqual([
				'<b>bold</b>',
				'<i>italic</i>',
			])
		})
	})

	describe('parseTags', () => {
		it('splits by whitespace', () => {
			expect(parseTags('tag1 tag2 tag3')).toEqual(['tag1', 'tag2', 'tag3'])
		})

		it('handles empty string', () => {
			expect(parseTags('')).toEqual([])
			expect(parseTags('   ')).toEqual([])
		})

		it('handles multiple spaces', () => {
			expect(parseTags('tag1   tag2')).toEqual(['tag1', 'tag2'])
		})

		it('preserves hierarchical tags', () => {
			expect(parseTags('parent::child other')).toEqual(['parent::child', 'other'])
		})
	})

	describe('parseDeckPath', () => {
		it('splits by deck separator', () => {
			expect(parseDeckPath('Parent::Child::Grandchild')).toEqual([
				'Parent',
				'Child',
				'Grandchild',
			])
		})

		it('handles single segment', () => {
			expect(parseDeckPath('Default')).toEqual(['Default'])
		})

		it('handles empty segments (malformed)', () => {
			expect(parseDeckPath('Parent::::Child')).toEqual(['Parent', '', 'Child'])
		})
	})

	describe('decodeLeft', () => {
		it('decodes remaining steps and remaining today', () => {
			// left = remainingSteps + (remainingToday * 1000)
			expect(decodeLeft(2003)).toEqual([3, 2]) // 3 steps, 2 today
			expect(decodeLeft(1001)).toEqual([1, 1]) // 1 step, 1 today
			expect(decodeLeft(0)).toEqual([0, 0])
		})

		it('handles large remaining today values', () => {
			expect(decodeLeft(10005)).toEqual([5, 10])
		})
	})
})

describe('Constants', () => {
	it('FIELD_SEPARATOR is correct', () => {
		expect(FIELD_SEPARATOR).toBe('\x1f')
		expect(FIELD_SEPARATOR.charCodeAt(0)).toBe(31) // U+001F
	})

	it('DECK_SEPARATOR is correct', () => {
		expect(DECK_SEPARATOR).toBe('::')
	})
})
