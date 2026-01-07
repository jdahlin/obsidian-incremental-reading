import { describe, expect, it } from 'vitest';
import {
	ALL_EXTRACTS_YAML,
	BY_SOURCE_YAML,
	DUE_TODAY_YAML,
	ITEMS_YAML,
	LEARNING_YAML,
	NEW_CARDS_YAML,
	TOPICS_YAML,
} from '../../bases/definitions';
import { evaluateFormulas, evaluateViews, parseBaseDefinition, type NoteRecord } from './runtime';

const now = new Date('2024-01-20T12:00:00');

const notes: NoteRecord[] = [
	{
		note: {
			type: 'topic',
			status: 'review',
			due: new Date('2024-01-19T12:00:00'),
			priority: 10,
			stability: 5,
			lapses: 0,
			reps: 2,
			scroll_pos: 0,
			source: 'Source A',
			created: new Date('2024-01-01T00:00:00'),
		},
		file: { name: 'Topic Review', tags: ['topic'] },
	},
	{
		note: {
			type: 'topic',
			status: 'new',
			due: new Date('2024-01-25T12:00:00'),
			priority: 20,
			stability: 11,
			lapses: 0,
			reps: 0,
			scroll_pos: 10,
			source: 'Source B',
			created: new Date('2024-01-05T00:00:00'),
		},
		file: { name: 'Topic New', tags: ['topic'] },
	},
	{
		note: {
			type: 'item',
			status: 'review',
			due: new Date('2024-01-18T12:00:00'),
			priority: 5,
			stability: 12,
			lapses: 4,
			reps: 5,
			scroll_pos: 0,
			source: 'Source A',
			created: new Date('2024-01-02T00:00:00'),
		},
		file: { name: 'Item Review', tags: ['topic'] },
	},
	{
		note: {
			type: 'topic',
			status: 'learning',
			due: new Date('2024-01-20T11:00:00'),
			priority: 30,
			stability: 4,
			lapses: 1,
			reps: 1,
			scroll_pos: 5,
			source: 'Source C',
			created: new Date('2024-01-10T00:00:00'),
		},
		file: { name: 'Topic Learning', tags: ['topic'] },
	},
	{
		note: {
			type: 'item',
			status: 'relearning',
			due: new Date('2024-01-20T10:00:00'),
			priority: 25,
			stability: 2,
			lapses: 2,
			reps: 3,
			scroll_pos: 0,
			source: 'Source D',
			created: new Date('2024-01-12T00:00:00'),
		},
		file: { name: 'Item Relearning', tags: ['topic'] },
	},
	{
		note: {
			type: 'topic',
			status: 'review',
			due: new Date('2024-01-19T12:00:00'),
			priority: 15,
			stability: 5,
			lapses: 0,
			reps: 2,
			scroll_pos: 0,
			source: 'Source E',
			created: new Date('2024-01-01T00:00:00'),
		},
		file: { name: 'Other Tag', tags: ['other'] },
	},
];

describe('Due Today.base', () => {
	it('includes only due, non-new extract notes', () => {
		const base = parseBaseDefinition(DUE_TODAY_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['Due for Review'].map((note) => note.file.name)).toEqual([
			'Topic Review',
			'Item Review',
			'Topic Learning',
			'Item Relearning',
		]);
	});

	it('computes days_overdue formula', () => {
		const base = parseBaseDefinition(DUE_TODAY_YAML);
		const formulaValues = evaluateFormulas(base.formulas ?? {}, notes[0], now);
		expect(formulaValues.days_overdue).toBeCloseTo(1, 4);
	});
});

describe('Topics.base', () => {
	it('filters to topic notes for All Topics and Due Topics views', () => {
		const base = parseBaseDefinition(TOPICS_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['All Topics'].map((note) => note.file.name)).toEqual([
			'Topic Review',
			'Topic New',
			'Topic Learning',
		]);
		expect(results['Due Topics'].map((note) => note.file.name)).toEqual([
			'Topic Review',
			'Topic Learning',
		]);
	});
});

describe('Items.base', () => {
	it('filters to item notes for All Items and Due Items views', () => {
		const base = parseBaseDefinition(ITEMS_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['All Items'].map((note) => note.file.name)).toEqual([
			'Item Review',
			'Item Relearning',
		]);
		expect(results['Due Items'].map((note) => note.file.name)).toEqual([
			'Item Review',
			'Item Relearning',
		]);
	});

	it('computes health formula', () => {
		const base = parseBaseDefinition(ITEMS_YAML);
		const formulaValues = evaluateFormulas(base.formulas ?? {}, notes[2], now);
		expect(formulaValues.health).toBe('Struggling');
	});
});

describe('New Cards.base', () => {
	it('filters to new extract notes', () => {
		const base = parseBaseDefinition(NEW_CARDS_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['New Cards'].map((note) => note.file.name)).toEqual(['Topic New']);
	});
});

describe('Learning.base', () => {
	it('filters to learning and relearning notes', () => {
		const base = parseBaseDefinition(LEARNING_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['In Learning'].map((note) => note.file.name)).toEqual([
			'Topic Learning',
			'Item Relearning',
		]);
	});
});

describe('All Extracts.base', () => {
	it('includes all extract notes', () => {
		const base = parseBaseDefinition(ALL_EXTRACTS_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['All Cards'].map((note) => note.file.name)).toEqual([
			'Topic Review',
			'Topic New',
			'Item Review',
			'Topic Learning',
			'Item Relearning',
		]);
	});

	it('computes next_review and health formulas', () => {
		const base = parseBaseDefinition(ALL_EXTRACTS_YAML);
		const valuesOverdue = evaluateFormulas(base.formulas ?? {}, notes[0], now);
		const valuesFuture = evaluateFormulas(base.formulas ?? {}, notes[1], now);
		const valuesHealth = evaluateFormulas(base.formulas ?? {}, notes[2], now);
		expect(valuesOverdue.next_review).toBe('Overdue');
		expect(valuesFuture.next_review).toEqual(notes[1].note.due);
		expect(valuesHealth.health).toBe('Struggling');
	});
});

describe('By Source.base', () => {
	it('includes all extract notes in grouped view', () => {
		const base = parseBaseDefinition(BY_SOURCE_YAML);
		const results = evaluateViews(base, notes, now);
		expect(results['Grouped by Source'].map((note) => note.file.name)).toEqual([
			'Topic Review',
			'Topic New',
			'Item Review',
			'Topic Learning',
			'Item Relearning',
		]);
	});
});
