import config, { allBoundaries, jsConfigOverride } from '@repo/eslint-config'

// Ignore hub package entirely - it's external/generated code with its own lint setup
// Ignore shell package config files
const ignores = {
	ignores: [
		'packages/hub/**',
		'packages/shell/postcss.config.js',
		'packages/shell/tailwind.config.ts',
	],
}

// Relax strict rules for shell package
const shellOverride = {
	files: ['packages/shell/**/*.{ts,tsx}'],
	rules: {
		'@typescript-eslint/strict-boolean-expressions': 'off',
		'@typescript-eslint/prefer-readonly-parameter-types': 'off',
	},
}

export default [...(await config), ...allBoundaries, jsConfigOverride, ignores, shellOverride]
