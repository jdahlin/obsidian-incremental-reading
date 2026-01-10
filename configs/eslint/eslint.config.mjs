import antfu from '@antfu/eslint-config';
import { allBoundaries } from './boundaries.mjs';

const baseConfig = antfu({
	typescript: {
		tsconfigPath: 'tsconfig.json',
	},
	jsonc: false, // Disable JSON linting to avoid type-aware rule conflicts
	stylistic: false, // Disable all stylistic rules - Prettier handles formatting
	rules: {
		// Prevent inline TypeScript suppressions - require documented ts-expect-error
		'@typescript-eslint/ban-ts-comment': [
			'error',
			{
				'ts-expect-error': 'allow-with-description',
				'ts-ignore': true,
				'ts-nocheck': true,
			},
		],

		// Async safety
		'@typescript-eslint/no-floating-promises': 'error',
		'@typescript-eslint/no-misused-promises': 'error',
		'@typescript-eslint/require-await': 'off', // Allow async for interface compatibility

		// Type safety
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-non-null-assertion': 'warn',
		'@typescript-eslint/no-unsafe-argument': 'error',
		'@typescript-eslint/no-unsafe-assignment': 'error',
		'@typescript-eslint/no-unsafe-call': 'error',
		'@typescript-eslint/no-unsafe-member-access': 'error',
		'@typescript-eslint/no-unsafe-return': 'error',
		'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

		// Logic validation
		'@typescript-eslint/switch-exhaustiveness-check': 'warn',
		'@typescript-eslint/strict-boolean-expressions': 'warn', // Warn only to allow gradual migration

		// Disable rules that might not be configured
		'import/no-nodejs-modules': 'off',
		'regexp/no-super-linear-backtracking': 'warn',
		'regexp/no-misleading-capturing-group': 'warn',
		'regexp/no-unused-capturing-group': 'warn',
		'node/prefer-global/process': 'off',
		'no-cond-assign': 'off', // Allow assignment in while loops
		'ts/no-use-before-define': 'off', // Allow hoisted functions

		// Disable antfu-specific rules that conflict with Prettier
		'antfu/if-newline': 'off',
		'antfu/consistent-list-newline': 'off',
	},
	ignores: [
		'**/package.json',
		'**/tsconfig.json',
		'**/vitest.config.ts',
		'**/*.mjs',
		'**/*.cjs',
		'**/manifest.json',
		'**/versions.json',
	],
});

// Disable type-aware rules for JS/MJS config files
const jsConfigOverride = {
	files: ['**/*.mjs', '**/*.js', '**/*.cjs'],
	rules: {
		'@typescript-eslint/no-floating-promises': 'off',
		'@typescript-eslint/no-misused-promises': 'off',
		'@typescript-eslint/require-await': 'off',
		'@typescript-eslint/no-unsafe-argument': 'off',
		'@typescript-eslint/no-unsafe-assignment': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-return': 'off',
		'@typescript-eslint/switch-exhaustiveness-check': 'off',
		'@typescript-eslint/strict-boolean-expressions': 'off',
	},
};

// Relax type-safety rules in test files
const testOverride = {
	files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts', '**/tests/**/*.tsx'],
	rules: {
		'@typescript-eslint/no-unsafe-argument': 'off',
		'@typescript-eslint/no-unsafe-assignment': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-return': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/strict-boolean-expressions': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
	},
};

// antfu() returns a FlatConfigComposer which extends Promise
// Call .toConfigs() for a flat array, or use .append() for composition
export default baseConfig;
export { allBoundaries, jsConfigOverride, testOverride };
