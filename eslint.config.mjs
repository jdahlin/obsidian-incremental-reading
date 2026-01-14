import config, { allBoundaries, jsConfigOverride } from '@repo/eslint-config'

// Disable prefer-readonly-parameter-types for hub package - too strict for React apps
const hubOverride = {
	files: ['packages/hub/**/*.tsx', 'packages/hub/**/*.ts'],
	rules: {
		'ts/prefer-readonly-parameter-types': 'off',
	},
}

export default [...(await config), ...allBoundaries, jsConfigOverride, hubOverride]
