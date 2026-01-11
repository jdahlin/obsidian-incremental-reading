import config, { allBoundaries, testOverride } from '@repo/eslint-config'

// CLI-specific override to allow console statements
const cliOverride = {
	files: ['**/*.ts', '**/*.tsx'],
	rules: {
		'no-console': 'off',
	},
}

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(cliOverride)
