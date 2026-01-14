import config, { allBoundaries, testOverride } from '@repo/eslint-config'

// API backend override to allow console statements for logging
const apiOverride = {
	files: ['**/*.ts'],
	rules: {
		'no-console': 'off',
	},
}

// Route handlers use Hono framework types that are mutable by design
const routeOverride = {
	files: ['**/routes/*.ts'],
	rules: {
		'ts/prefer-readonly-parameter-types': 'off',
	},
}

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(apiOverride)
	.append(routeOverride)
