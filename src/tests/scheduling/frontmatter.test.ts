import { describe, expect, it } from 'vitest';
import { formatDate, normalizeNumber, normalizeStatus, normalizeTags, normalizeType, parseDate, readCardState } from '../../scheduling/frontmatter';

describe('tag normalization', () => {
	it('recognizes tag in array format: ["topic"]', () => {
		expect(normalizeTags(['topic'])).toEqual(['topic']);
	});

	it('recognizes tag in array with hash: ["#topic"]', () => {
		expect(normalizeTags(['#topic'])).toEqual(['topic']);
	});

	it('recognizes tag as string: "topic"', () => {
		expect(normalizeTags('topic')).toEqual(['topic']);
	});

	it('recognizes tag as string with hash: "#topic"', () => {
		expect(normalizeTags('#topic')).toEqual(['topic']);
	});

	it('recognizes tag in comma-separated string: "foo, topic, bar"', () => {
		expect(normalizeTags('foo, topic, bar')).toEqual(['foo', 'topic', 'bar']);
	});

	it('returns null for files without the extract tag', async () => {
		const app = {
			metadataCache: {
				getFileCache: () => ({ frontmatter: { tags: ['other'] } }),
			},
		};
		const file = { stat: { ctime: new Date('2024-01-01T00:00:00').getTime() } };
		const state = await readCardState(app as never, file as never, 'topic');
		expect(state).toBeNull();
	});
});

describe('date parsing', () => {
	it('parses ISO date string: "2024-01-15T10:30:00"', () => {
		const parsed = parseDate('2024-01-15T10:30:00');
		expect(parsed?.toISOString()).toBe(new Date('2024-01-15T10:30:00').toISOString());
	});

	it('parses date-only string: "2024-01-15"', () => {
		const parsed = parseDate('2024-01-15');
		expect(parsed?.getFullYear()).toBe(2024);
		expect(parsed?.getMonth()).toBe(0);
		expect(parsed?.getDate()).toBe(15);
	});

	it('uses file ctime when created is missing', async () => {
		const ctime = new Date('2024-01-05T08:00:00');
		const app = {
			metadataCache: {
				getFileCache: () => ({ frontmatter: { tags: ['topic'] } }),
			},
		};
		const file = { stat: { ctime: ctime.getTime() } };
		const state = await readCardState(app as never, file as never, 'topic');
		expect(state?.created.getTime()).toBe(ctime.getTime());
	});

	it('uses created date when due is missing', async () => {
		const created = '2024-01-10T12:00:00';
		const app = {
			metadataCache: {
				getFileCache: () => ({ frontmatter: { tags: ['topic'], created } }),
			},
		};
		const file = { stat: { ctime: new Date('2024-01-01T00:00:00').getTime() } };
		const state = await readCardState(app as never, file as never, 'topic');
		expect(state?.due.getTime()).toBe(new Date(created).getTime());
	});

	it('handles Date objects directly', () => {
		const date = new Date('2024-02-01T09:00:00');
		expect(parseDate(date)).toBe(date);
	});

	it('returns null for invalid date strings', () => {
		expect(parseDate('not-a-date')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseDate('   ')).toBeNull();
	});
});

describe('type normalization', () => {
	it('returns "item" when type is "item"', () => {
		expect(normalizeType('item')).toBe('item');
	});

	it('returns "topic" when type is "topic"', () => {
		expect(normalizeType('topic')).toBe('topic');
	});

	it('returns "topic" when type is undefined', () => {
		expect(normalizeType(undefined)).toBe('topic');
	});

	it('returns "topic" for any other value', () => {
		expect(normalizeType('other')).toBe('topic');
	});
});

describe('status normalization', () => {
	it('returns valid status values unchanged: new, learning, review, relearning', () => {
		expect(normalizeStatus('new')).toBe('new');
		expect(normalizeStatus('learning')).toBe('learning');
		expect(normalizeStatus('review')).toBe('review');
		expect(normalizeStatus('relearning')).toBe('relearning');
	});

	it('returns "new" for undefined status', () => {
		expect(normalizeStatus(undefined)).toBe('new');
	});

	it('returns "new" for invalid status values', () => {
		expect(normalizeStatus('other')).toBe('new');
	});
});

describe('number normalization', () => {
	it('returns number values unchanged', () => {
		expect(normalizeNumber(12, 0)).toBe(12);
	});

	it('parses numeric strings: "50" -> 50', () => {
		expect(normalizeNumber('50', 0)).toBe(50);
	});

	it('returns fallback for undefined', () => {
		expect(normalizeNumber(undefined, 42)).toBe(42);
	});

	it('returns fallback for non-numeric strings', () => {
		expect(normalizeNumber('abc', 7)).toBe(7);
	});

	it('returns fallback for NaN', () => {
		expect(normalizeNumber(NaN, 9)).toBe(9);
	});

	it('returns fallback for Infinity', () => {
		expect(normalizeNumber(Infinity, 11)).toBe(11);
	});
});

describe('date formatting', () => {
	it('formats date as ISO without timezone: YYYY-MM-DDTHH:MM:SS', () => {
		const value = new Date(2024, 0, 2, 3, 4, 5);
		expect(formatDate(value)).toBe('2024-01-02T03:04:05');
	});

	it('pads single-digit months and days with zeros', () => {
		const value = new Date(2024, 2, 9, 10, 11, 12);
		expect(formatDate(value)).toBe('2024-03-09T10:11:12');
	});

	it('pads single-digit hours, minutes, seconds with zeros', () => {
		const value = new Date(2024, 5, 10, 1, 2, 3);
		expect(formatDate(value)).toBe('2024-06-10T01:02:03');
	});
});
