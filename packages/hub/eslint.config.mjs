import config, { allBoundaries, jsConfigOverride, testOverride } from '@repo/eslint-config'

// Disable prefer-readonly-parameter-types for hub package - too strict for React apps
// We've already made interfaces readonly where it makes sense
const hubOverride = {
	files: ['**/*.tsx', '**/*.ts'],
	rules: {
		'ts/prefer-readonly-parameter-types': 'off',
	},
}

// Ignore config files that aren't in TypeScript project
const ignoreConfigFiles = {
	ignores: ['postcss.config.js', 'tailwind.config.js', 'tailwind.config.ts', 'vite.config.ts'],
}

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(jsConfigOverride)
	.append(ignoreConfigFiles)
	.append(hubOverride)
