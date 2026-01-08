import { describe, expect, it } from 'vitest';
import {
	parseClozeIndices,
	getNextClozeIndex,
	getHighestClozeIndex,
	formatClozeQuestion,
	formatClozeAnswer,
	escapeHtmlText,
} from '../../src/core/cloze';

describe('cloze parsing', () => {
	it('collects sorted unique cloze indices', () => {
		const content = 'A {{c3::x}} B {{c1::y}} C {{c2::z}} D {{c1::again}}';
		expect(parseClozeIndices(content)).toEqual([1, 2, 3]);
	});

	it('returns next index when clozes exist', () => {
		const content = 'A {{c2::x}} B {{c5::y}}';
		expect(getNextClozeIndex(content)).toBe(6);
	});

	it('returns 1 when no cloze exists', () => {
		expect(getNextClozeIndex('no cloze here')).toBe(1);
	});

	it('returns highest cloze index or null', () => {
		expect(getHighestClozeIndex('no cloze here')).toBeNull();
		expect(getHighestClozeIndex('A {{c2::x}} B {{c7::y}}')).toBe(7);
	});
});

describe('cloze formatting', () => {
	it('formats question with hint and preserves other text', () => {
		const content = 'A {{c1::alpha}} B {{c2::beta::hint}}';
		const formatted = formatClozeQuestion(content, 2);
		expect(formatted).toBe('A alpha B [...] (hint)');
	});

	it('formats question without hint', () => {
		const content = 'A {{c1::alpha}} B {{c2::beta}}';
		const formatted = formatClozeQuestion(content, 1);
		expect(formatted).toBe('A [...] B beta');
	});

	it('formats answer by removing all cloze wrappers', () => {
		const content = 'A {{c1::alpha}} B {{c2::beta::hint}}';
		const formatted = formatClozeAnswer(content, 1);
		expect(formatted).toBe('A alpha B beta');
	});
});

describe('HTML escaping', () => {
	it('escapes HTML special characters', () => {
		const input = 'Tom & Jerry <"cat">\'s';
		const expected = 'Tom &amp; Jerry &lt;&quot;cat&quot;&gt;&#39;s';
		expect(escapeHtmlText(input)).toBe(expected);
	});
});
