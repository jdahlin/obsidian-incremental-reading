import { defineConfig } from 'vitest/config'

export const config = {
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.test.{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		passWithNoTests: true,
		coverage: {
			provider: 'v8' as const,
			reporter: ['json-summary'],
			reportsDirectory: './coverage',
			exclude: [
				'**/node_modules/**',
				'**/dist/**',
				'**/*.test.{ts,tsx}',
				'**/*.types.ts',
				'**/*.css',
				'**/*.d.ts',
			],
			include: ['src/**'],
			all: true,
		},
	},
}

export default defineConfig(config)
