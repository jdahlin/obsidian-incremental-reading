import { resolve } from 'node:path'
import { config } from '@repo/vitest-config'
import { defineConfig, mergeConfig } from 'vitest/config'

export default mergeConfig(
	defineConfig(config),
	defineConfig({
		test: {
			testTimeout: 10000,
		},
		resolve: {
			alias: {
				'@repo/core': resolve(__dirname, '../core/src'),
			},
		},
	}),
)
