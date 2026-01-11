#!/usr/bin/env tsx
/**
 * Reads coverage-summary.json from each package and prints a one-line summary.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface CoverageSummary {
	total: {
		lines: { pct: number }
		statements: { pct: number }
		functions: { pct: number }
		branches: { pct: number }
	}
}

const packagesDir = join(import.meta.dirname, '..', 'packages')
const packages = readdirSync(packagesDir)

console.log('\nCoverage Summary:')
console.log('─'.repeat(60))

let hasAnyCoverage = false

for (const pkg of packages) {
	const coveragePath = join(packagesDir, pkg, 'coverage', 'coverage-summary.json')

	if (!existsSync(coveragePath)) {
		continue
	}

	hasAnyCoverage = true

	try {
		const data = JSON.parse(readFileSync(coveragePath, 'utf-8')) as CoverageSummary
		const { lines, branches, functions } = data.total

		const format = (pct: number) => pct.toFixed(1).padStart(5) + '%'

		console.log(
			`${pkg.padEnd(20)} Lines: ${format(lines.pct)}  Branches: ${format(branches.pct)}  Functions: ${format(functions.pct)}`,
		)
	} catch {
		console.log(`${pkg.padEnd(20)} (error reading coverage)`)
	}
}

if (!hasAnyCoverage) {
	console.log('No coverage data found. Run pnpm test:coverage first.')
}

console.log('')
