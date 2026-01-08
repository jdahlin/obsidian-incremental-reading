import { describe, expect, it } from 'vitest';
import { App } from 'obsidian';
import { ensureBasesFolder } from '../../src/bases';

const baseFiles = ['IR/All Items.base', 'IR/Due Today.base', 'IR/Struggling.base'];

describe('bases', () => {
	it('creates base files when missing', async () => {
		const app = new App();
		await ensureBasesFolder(app);

		for (const path of baseFiles) {
			const content = await app.vault.adapter.read(path);
			expect(content).toContain('filters:');
		}
	});
});
