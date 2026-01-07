import { describe, expect, it } from 'vitest';
import { escapeHtmlText, getHighestClozeIndex, getNextClozeIndex } from '../../commands/cloze';

describe('getNextClozeIndex', () => {
	it('returns 1 for content with no clozes', () => {
		expect(getNextClozeIndex('No cloze here.')).toBe(1);
	});

	it('returns 2 when content has {{c1::text}}', () => {
		expect(getNextClozeIndex('Here is {{c1::text}}.')).toBe(2);
	});

	it('returns 4 when highest cloze is c3', () => {
		expect(getNextClozeIndex('{{c3::text}}')).toBe(4);
	});

	it('finds highest index across multiple clozes', () => {
		expect(getNextClozeIndex('{{c2::a}} {{c10::b}} {{c3::c}}')).toBe(11);
	});

	it('ignores malformed cloze syntax', () => {
		expect(getNextClozeIndex('{{c::nope}} {{cX::bad}}')).toBe(1);
	});

	it('handles cloze indices in any order', () => {
		expect(getNextClozeIndex('{{c5::a}} {{c1::b}} {{c3::c}}')).toBe(6);
	});
});

describe('getHighestClozeIndex', () => {
	it('returns null for content with no clozes', () => {
		expect(getHighestClozeIndex('Nothing here.')).toBeNull();
	});

	it('returns 1 when only c1 exists', () => {
		expect(getHighestClozeIndex('{{c1::text}}')).toBe(1);
	});

	it('returns highest index present', () => {
		expect(getHighestClozeIndex('{{c2::a}} {{c5::b}} {{c3::c}}')).toBe(5);
	});
});

describe('cloze text escaping', () => {
	it('escapes < to &lt;', () => {
		expect(escapeHtmlText('<')).toBe('&lt;');
	});

	it('escapes > to &gt;', () => {
		expect(escapeHtmlText('>')).toBe('&gt;');
	});

	it('escapes & to &amp;', () => {
		expect(escapeHtmlText('&')).toBe('&amp;');
	});

	it('preserves normal text unchanged', () => {
		expect(escapeHtmlText('plain text')).toBe('plain text');
	});
});
