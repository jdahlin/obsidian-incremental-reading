import type { App, TFile } from 'obsidian';

export async function getBreadcrumbs(app: App, file: TFile): Promise<TFile[]> {
	const chain: TFile[] = [file];
	let current = file;

	while (true) {
		const fm = app.metadataCache.getFileCache(current)?.frontmatter;
		const sourceLink = typeof fm?.source === 'string' ? fm.source : '';
		if (!sourceLink) break;

		const clean = sourceLink.replace(/^\[\[|\]\]$/g, '');
		const parent = app.metadataCache.getFirstLinkpathDest(clean, current.path);
		if (!parent || chain.includes(parent)) break;

		chain.unshift(parent);
		current = parent;
	}

	return chain;
}
