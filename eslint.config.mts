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
				projectService: {
					allowDefaultProject: ['eslint.config.js', 'manifest.json', '.nano-staged.js'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
		rules: {
			// This repo is an Obsidian plugin (not a typical Node runtime) and ESLint's package.json
			// detection can be flaky with TS projectService; avoid false positives for deps like react.
			'import/no-extraneous-dependencies': 'off',

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
	...obsidianmd.configs.recommended,
	globalIgnores([
		'node_modules',
		'dist',
		'coverage',
		'tests',
		'build-css',
		'css-tmp',
		'esbuild.config.mjs',
		'eslint.config.js',
		'vitest.config.ts',
		'version-bump.mjs',
		'versions.json',
		'main.js',
	]),
);
