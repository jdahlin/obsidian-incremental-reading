import config, { allBoundaries, jsConfigOverride, testOverride } from '@repo/eslint-config'

export default config
	.append(...allBoundaries)
	.append(testOverride)
	.append(jsConfigOverride)
