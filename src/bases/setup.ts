import type { App } from 'obsidian';
import {
	ALL_EXTRACTS_YAML,
	BY_SOURCE_YAML,
	DUE_TODAY_YAML,
	ITEMS_YAML,
	LEARNING_YAML,
	NEW_CARDS_YAML,
	TOPICS_YAML,
} from './definitions';

const BASE_FILES: Record<string, string> = {
	'Due Today.base': DUE_TODAY_YAML,
	'Topics.base': TOPICS_YAML,
	'Items.base': ITEMS_YAML,
	'New Cards.base': NEW_CARDS_YAML,
	'Learning.base': LEARNING_YAML,
	'All Extracts.base': ALL_EXTRACTS_YAML,
	'By Source.base': BY_SOURCE_YAML,
};

export async function ensureBasesFolder(app: App): Promise<void> {
	const adapter = app.vault.adapter;
	const folderPath = 'IR';

	if (!await adapter.exists(folderPath)) {
		await adapter.mkdir(folderPath);
	}

	for (const [filename, content] of Object.entries(BASE_FILES)) {
		const filePath = `${folderPath}/${filename}`;
		if (!await adapter.exists(filePath)) {
			await adapter.write(filePath, content);
		}
	}
}
