import config, { allBoundaries, testOverride } from '@repo/eslint-config'

export default config.append(...allBoundaries).append(testOverride)
