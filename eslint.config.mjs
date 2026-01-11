import config, { allBoundaries, jsConfigOverride } from '@repo/eslint-config'

export default [...(await config), ...allBoundaries, jsConfigOverride]
