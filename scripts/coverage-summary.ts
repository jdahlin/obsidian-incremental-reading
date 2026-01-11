#!/usr/bin/env tsx
/**
 * Reads coverage-summary.json from each package and prints a summary.
 * Use --verbose or -v to show per-file coverage details.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

interface CoverageEntry {
	lines: { pct: number; total: number; covered: number }
	statements: { pct: number }
	functions: { pct: number; total: number; covered: number }
	branches: { pct: number; total: number; covered: number }
}

interface CoverageSummary {
	total: CoverageEntry
	[filePath: string]: CoverageEntry
}

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')
const packagesDir = join(import.meta.dirname, '..', 'packages')
const packages = readdirSync(packagesDir)

const format = (pct: number) => pct.toFixed(1).padStart(5) + '%'
const colorize = (pct: number, str: string) => {
	if (pct >= 80) return `\x1b[32m${str}\x1b[0m` // green
	if (pct >= 50) return `\x1b[33m${str}\x1b[0m` // yellow
	return `\x1b[31m${str}\x1b[0m` // red
}

// Totals for verbose mode
let totalLines = { covered: 0, total: 0 }
let totalBranches = { covered: 0, total: 0 }
let totalFunctions = { covered: 0, total: 0 }

console.log('\nCoverage Summary:')
console.log('─'.repeat(75))

if (verbose) {
	console.log(
		`${'File'.padEnd(52)} ${'Lines'.padStart(6)}  ${'Branch'.padStart(6)}  ${'Funcs'.padStart(6)}`,
	)
	console.log('─'.repeat(75))
}

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

		if (verbose) {
			// Accumulate totals
			totalLines.covered += lines.covered
			totalLines.total += lines.total
			totalBranches.covered += branches.covered
			totalBranches.total += branches.total
			totalFunctions.covered += functions.covered
			totalFunctions.total += functions.total

			const pkgRoot = join(packagesDir, pkg)
			const files = Object.keys(data).filter((key) => key !== 'total')

			console.log(`\x1b[1m${pkg}\x1b[0m`)

			for (const filePath of files.sort()) {
				const entry = data[filePath]
				if (!entry) continue

				// Skip files with 100% coverage across all metrics
				if (
					entry.lines.pct === 100 &&
					entry.branches.pct === 100 &&
					entry.functions.pct === 100
				) {
					continue
				}

				const relPath = relative(pkgRoot, filePath)
				const fLinePct = colorize(entry.lines.pct, format(entry.lines.pct))
				const fBranchPct = colorize(entry.branches.pct, format(entry.branches.pct))
				const fFuncPct = colorize(entry.functions.pct, format(entry.functions.pct))

				console.log(`  ${relPath.padEnd(50)} ${fLinePct}  ${fBranchPct}  ${fFuncPct}`)
			}
			console.log('')
		} else {
			const linePct = colorize(lines.pct, format(lines.pct))
			const branchPct = colorize(branches.pct, format(branches.pct))
			const funcPct = colorize(functions.pct, format(functions.pct))

			console.log(
				`${pkg.padEnd(20)} Lines: ${linePct}  Branches: ${branchPct}  Functions: ${funcPct}`,
			)
		}
	} catch {
		console.log(`${pkg.padEnd(20)} (error reading coverage)`)
	}
}

if (!hasAnyCoverage) {
	console.log('No coverage data found. Run pnpm test:coverage first.')
}

if (verbose && hasAnyCoverage) {
	const linesPct = totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 0
	const branchesPct =
		totalBranches.total > 0 ? (totalBranches.covered / totalBranches.total) * 100 : 0
	const functionsPct =
		totalFunctions.total > 0 ? (totalFunctions.covered / totalFunctions.total) * 100 : 0

	console.log('─'.repeat(75))
	console.log(
		`${'Total'.padEnd(52)} ${colorize(linesPct, format(linesPct))}  ${colorize(branchesPct, format(branchesPct))}  ${colorize(functionsPct, format(functionsPct))}`,
	)
}

console.log('')
