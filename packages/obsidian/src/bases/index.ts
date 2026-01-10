import type { App } from 'obsidian';
import { ALL_ITEMS_YAML, DUE_TODAY_YAML, STRUGGLING_YAML } from './definitions';

const BASE_FILES: Record<string, string> = {
	'IR/All Items.base': ALL_ITEMS_YAML,
	'IR/Due Today.base': DUE_TODAY_YAML,
	'IR/Struggling.base': STRUGGLING_YAML,
};

export async function ensureBasesFolder(app: App): Promise<void> {
	const adapter = app.vault.adapter;
	const root = 'IR';
	if (!(await adapter.exists(root))) {
		await adapter.mkdir(root);
	}

	for (const [path, content] of Object.entries(BASE_FILES)) {
		if (!(await adapter.exists(path))) {
			await adapter.write(path, content);
		}
	}
}
