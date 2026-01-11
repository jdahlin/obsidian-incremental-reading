import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, 'src/tests/obsidian-stub.ts'),
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			all: true,
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['src/css.d.ts'],
		},
	},
})
