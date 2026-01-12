import config, { allBoundaries, testOverride } from '@repo/eslint-config'

// API backend override to allow console statements for logging
const apiOverride = {
	files: ['**/*.ts'],
	rules: {
		'no-console': 'off',
	},
}

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(apiOverride)
