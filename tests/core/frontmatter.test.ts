import { describe, expect, it } from 'vitest';
import {
	normalizeTags,
	normalizeType,
	normalizeStatus,
	normalizeNumber,
	parseDate,
	formatDate,
	parseFrontmatter,
	serializeFrontmatter,
} from '../../src/core/frontmatter';

describe('frontmatter normalization', () => {
	it('normalizes tags from arrays and strings', () => {
		expect(normalizeTags(['#topic', ' item '])).toEqual(['topic', 'item']);
		expect(normalizeTags('foo, #topic bar')).toEqual(['foo', 'topic', 'bar']);
	});

	it('normalizes type and status', () => {
		expect(normalizeType('item')).toBe('item');
		expect(normalizeType('other')).toBe('topic');
		expect(normalizeStatus('review')).toBe('review');
		expect(normalizeStatus('unknown')).toBe('new');
	});

	it('normalizes numbers from strings and fallbacks', () => {
		expect(normalizeNumber('42', 0)).toBe(42);
		expect(normalizeNumber('nope', 7)).toBe(7);
		expect(normalizeNumber(Infinity, 5)).toBe(5);
	});

	it('parses and formats dates', () => {
		const date = new Date('2024-01-02T03:04:05');
		expect(parseDate('2024-01-02T03:04:05')?.getTime()).toBe(date.getTime());
		expect(formatDate(date)).toBe('2024-01-02T03:04:05');
		expect(parseDate('not-a-date')).toBeNull();
	});
});

describe('frontmatter parsing and serialization', () => {
	it('parses frontmatter with extract tag filtering', () => {
		const raw = {
			ir_note_id: 'note-1',
			tags: ['topic', 'other'],
			type: 'item',
			priority: 12,
			created: '2024-01-01T00:00:00',
		};
		const parsed = parseFrontmatter(raw, 'topic');
		expect(parsed?.ir_note_id).toBe('note-1');
		expect(parsed?.type).toBe('item');
		expect(parsed?.priority).toBe(12);
		expect(parsed?.created?.getTime()).toBe(new Date('2024-01-01T00:00:00').getTime());
	});

	it('returns null when extract tag is missing', () => {
		const raw = { tags: ['other'] };
		expect(parseFrontmatter(raw, 'topic')).toBeNull();
	});

	it('serializes frontmatter with dates and optional fields', () => {
		const record = serializeFrontmatter({
			ir_note_id: 'note-2',
			tags: ['topic'],
			type: 'topic',
			priority: 50,
			source: '[[Source]]',
			created: new Date('2024-01-02T03:04:05'),
		});
		expect(record).toEqual({
			ir_note_id: 'note-2',
			tags: ['topic'],
			type: 'topic',
			priority: 50,
			source: '[[Source]]',
			created: '2024-01-02T03:04:05',
		});
	});
});
