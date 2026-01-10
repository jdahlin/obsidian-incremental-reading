import { describe, expect, it } from 'vitest';
import { createId } from '../ids';

describe('createId', () => {
	it('generates a 12-character id from the allowed alphabet', () => {
		const id = createId();
		expect(id).toHaveLength(12);
		expect(id).toMatch(/^[0-9A-Z]+$/i);
	});
});
