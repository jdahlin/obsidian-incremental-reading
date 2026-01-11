import config, { allBoundaries, testOverride } from '@repo/eslint-config'

// Obsidian-specific overrides
const obsidianOverride = {
	files: ['**/*.ts', '**/*.tsx'],
	rules: {
		// Allow `new Notice()` for side effects (Obsidian pattern)
		'no-new': 'off',
	},
}

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(obsidianOverride)
