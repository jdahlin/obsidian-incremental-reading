import config, { testOverride } from '@repo/eslint-config'

export default config.prepend({ ignores: ['docs/**', '**/*.md'] }).append(testOverride)
