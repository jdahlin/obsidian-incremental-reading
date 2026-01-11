import { defineConfig, mergeConfig } from 'vitest/config'
import { config as sharedConfig } from '@repo/vitest-config'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node',
		},
	}),
)
