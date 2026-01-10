/**
 * ESLint boundary configurations for the monorepo.
 * Enforces architectural constraints between packages.
 *
 * Package hierarchy:
 * - @repo/core: Pure business logic, no external dependencies
 * - @repo/obsidian: Obsidian plugin, depends on core
 * - @repo/cli: CLI tool, depends on core
 */

/**
 * Creates a boundary configuration that restricts imports from specified packages.
 */
function createBoundary(files, blockedPackages) {
	const patterns = blockedPackages.map((pkg) => ({
		group: [`${pkg}`, `${pkg}/*`],
		message: `Importing from ${pkg} is not allowed in this package.`,
	}));

	return {
		files,
		rules: {
			'no-restricted-imports': ['error', { patterns }],
		},
	};
}

/**
 * @repo/core - Cannot import from obsidian or cli packages
 */
export const coreBoundary = createBoundary(
	['packages/core/src/**/*.ts'],
	['@repo/obsidian', '@repo/cli', 'obsidian', 'ink', 'react'],
);

/**
 * @repo/obsidian - Cannot import from cli package
 */
export const obsidianBoundary = createBoundary(
	['packages/obsidian/src/**/*.ts', 'packages/obsidian/src/**/*.tsx'],
	['@repo/cli', 'ink', 'react'],
);

/**
 * @repo/cli - Cannot import from obsidian package
 */
export const cliBoundary = createBoundary(
	['packages/cli/src/**/*.ts', 'packages/cli/src/**/*.tsx'],
	['@repo/obsidian', 'obsidian', 'preact'],
);

export const allBoundaries = [coreBoundary, obsidianBoundary, cliBoundary];
