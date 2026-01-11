import { resolve } from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import { config } from '@repo/vitest-config'

export default mergeConfig(
	defineConfig(config),
	defineConfig({
		test: {
			environment: 'jsdom',
		},
		resolve: {
			alias: {
				obsidian: resolve(__dirname, 'src/tests/obsidian-stub.ts'),
			},
		},
	}),
)
