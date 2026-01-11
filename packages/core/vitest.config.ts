import { defineConfig, mergeConfig } from 'vitest/config'
import { config } from '@repo/vitest-config'

export default mergeConfig(defineConfig(config), defineConfig({}))
