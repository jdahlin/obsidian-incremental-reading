import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	{
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
		rules: {
			// This repo is an Obsidian plugin (not a typical Node runtime) and ESLint's package.json
			// detection can be flaky with TS projectService; avoid false positives for deps like react.
			'import/no-extraneous-dependencies': 'off',

			'@typescript-eslint/ban-ts-comment': [
				'error',
				{
					'ts-ignore': true,
					'ts-nocheck': true,
					'ts-expect-error': true,
					'ts-check': true,
				},
			],

			// Make unused imports/vars a hard error so CI can't ignore them.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		ignores: ['src/engine/cli/**'],
		languageOptions: {
			parserOptions: {
				project: ['tsconfig.json', 'src/tests/tsconfig.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['package.json'],
		rules: {
			// js-yaml is 8x faster than yaml for our YAML-heavy test suite
			'depend/ban-dependencies': 'off',
		},
	},
	{
		files: ['src/engine/cli/**/*.ts', 'src/engine/cli/**/*.tsx'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				project: ['src/engine/cli/tsconfig.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'import/no-nodejs-modules': 'off',
		},
	},
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		rules: {
			'@typescript-eslint/no-deprecated': 'off',
		},
	},
	globalIgnores([
		'node_modules',
		'dist',
		'coverage',
		'build-css',
		'css-tmp',
		'e2e', // Playwright E2E tests have their own tsconfig
		'esbuild.config.mjs',
		'eslint.config.js',
		'vitest.config.ts',
		'version-bump.mjs',
		'versions.json',
		'main.js',
	]),
);
