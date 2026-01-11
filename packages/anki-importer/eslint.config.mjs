import config, { allBoundaries, testOverride } from '@repo/eslint-config'

export default config
	.prepend({ ignores: ['docs/**', '**/*.md'] })
	.append(...allBoundaries)
	.append(testOverride)
