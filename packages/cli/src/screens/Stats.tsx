import type { SessionManager } from '@repo/core/SessionManager'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'

interface StatsProps {
	session: SessionManager
	vaultPath: string
}

interface ReviewStats {
	today: { total: number; again: number; hard: number; good: number; easy: number }
	week: { total: number; again: number; hard: number; good: number; easy: number }
	streak: { current: number; longest: number }
	cards: { total: number; new: number; learning: number; due: number }
}

export function Stats({ session, vaultPath }: StatsProps) {
	const [stats, setStats] = useState<ReviewStats | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function loadStats() {
			try {
				// Get card counts from session pool
				const items = await session.getNextN(10000)
				const cardStats = {
					total: items.length,
					new: 0,
					learning: 0,
					due: 0,
				}

				const now = new Date()
				for (const item of items) {
					if (item.state.status === 'new') {
						cardStats.new++
					} else if (
						item.state.status === 'learning' ||
						item.state.status === 'relearning'
					) {
						cardStats.learning++
					} else if (item.state.due && item.state.due <= now) {
						cardStats.due++
					}
				}

				// Load review history from revlog
				const todayStats = { total: 0, again: 0, hard: 0, good: 0, easy: 0 }
				const weekStats = { total: 0, again: 0, hard: 0, good: 0, easy: 0 }
				const reviewDays = new Set<string>()

				const revlogPath = path.join(vaultPath, 'IR', 'Revlog')
				try {
					const files = await fs.readdir(revlogPath)
					const todayStr = now.toISOString().slice(0, 10)
					const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

					for (const file of files) {
						if (!file.endsWith('.md')) continue
						const content = await fs.readFile(path.join(revlogPath, file), 'utf-8')
						const lines = content.split('\n').filter((l) => l.trim())

						for (const line of lines) {
							try {
								const entry = JSON.parse(line) as {
									ts: string
									rating: number
								}
								const entryDate = new Date(entry.ts)
								const entryDateStr = entryDate.toISOString().slice(0, 10)
								reviewDays.add(entryDateStr)

								if (entryDateStr === todayStr) {
									todayStats.total++
									if (entry.rating === 1) todayStats.again++
									else if (entry.rating === 2) todayStats.hard++
									else if (entry.rating === 3) todayStats.good++
									else if (entry.rating === 4) todayStats.easy++
								}

								if (entryDate >= weekAgo) {
									weekStats.total++
									if (entry.rating === 1) weekStats.again++
									else if (entry.rating === 2) weekStats.hard++
									else if (entry.rating === 3) weekStats.good++
									else if (entry.rating === 4) weekStats.easy++
								}
							} catch {
								// Skip invalid lines
							}
						}
					}
				} catch {
					// No revlog folder yet
				}

				// Calculate streak
				const sortedDays = Array.from(reviewDays).sort().reverse()
				let currentStreak = 0
				let checkDate = new Date(now)
				checkDate.setHours(0, 0, 0, 0)

				for (const day of sortedDays) {
					const dayDate = new Date(day)
					dayDate.setHours(0, 0, 0, 0)
					const diffDays = Math.round(
						(checkDate.getTime() - dayDate.getTime()) / (24 * 60 * 60 * 1000),
					)

					if (diffDays <= 1) {
						currentStreak++
						checkDate = dayDate
					} else {
						break
					}
				}

				setStats({
					today: todayStats,
					week: weekStats,
					streak: { current: currentStreak, longest: currentStreak }, // TODO: track longest
					cards: cardStats,
				})
				setLoading(false)
			} catch (err) {
				console.error('Failed to load stats:', err)
				setLoading(false)
			}
		}

		void loadStats()
	}, [session, vaultPath])

	if (loading) {
		return (
			<Box padding={1}>
				<Text>Loading stats...</Text>
			</Box>
		)
	}

	if (!stats) {
		return (
			<Box padding={1}>
				<Text color="red">Failed to load stats</Text>
			</Box>
		)
	}

	const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => {
		const width = 30
		const filled = max > 0 ? Math.round((value / max) * width) : 0
		return (
			<Text>
				<Text color={color}>{'█'.repeat(filled)}</Text>
				<Text color="gray">{'░'.repeat(width - filled)}</Text>
			</Text>
		)
	}

	return (
		<Box flexDirection="column" padding={1} flexGrow={1}>
			<Text bold>Review Statistics</Text>

			<Box marginTop={1} flexDirection="column">
				<Text bold color="cyan">
					Today
				</Text>
				<Box>
					<Box width={12}>
						<Text>Reviewed:</Text>
					</Box>
					<Text bold>{stats.today.total}</Text>
				</Box>
				{stats.today.total > 0 && (
					<Box flexDirection="column" marginLeft={2}>
						<Box>
							<Box width={8}>
								<Text color="red">Again:</Text>
							</Box>
							<Box width={4}>
								<Text>{stats.today.again}</Text>
							</Box>
							<Bar value={stats.today.again} max={stats.today.total} color="red" />
						</Box>
						<Box>
							<Box width={8}>
								<Text color="yellow">Hard:</Text>
							</Box>
							<Box width={4}>
								<Text>{stats.today.hard}</Text>
							</Box>
							<Bar value={stats.today.hard} max={stats.today.total} color="yellow" />
						</Box>
						<Box>
							<Box width={8}>
								<Text color="blue">Good:</Text>
							</Box>
							<Box width={4}>
								<Text>{stats.today.good}</Text>
							</Box>
							<Bar value={stats.today.good} max={stats.today.total} color="blue" />
						</Box>
						<Box>
							<Box width={8}>
								<Text color="green">Easy:</Text>
							</Box>
							<Box width={4}>
								<Text>{stats.today.easy}</Text>
							</Box>
							<Bar value={stats.today.easy} max={stats.today.total} color="green" />
						</Box>
					</Box>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold color="cyan">
					This Week
				</Text>
				<Box>
					<Box width={12}>
						<Text>Reviewed:</Text>
					</Box>
					<Text bold>{stats.week.total}</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold color="cyan">
					Streak
				</Text>
				<Box>
					<Box width={12}>
						<Text>Current:</Text>
					</Box>
					<Text bold>{stats.streak.current} days</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold color="cyan">
					Cards
				</Text>
				<Box>
					<Box width={12}>
						<Text>Total:</Text>
					</Box>
					<Text bold>{stats.cards.total}</Text>
				</Box>
				<Box>
					<Box width={12}>
						<Text color="blue">New:</Text>
					</Box>
					<Text>{stats.cards.new}</Text>
				</Box>
				<Box>
					<Box width={12}>
						<Text color="yellow">Learning:</Text>
					</Box>
					<Text>{stats.cards.learning}</Text>
				</Box>
				<Box>
					<Box width={12}>
						<Text color="green">Due:</Text>
					</Box>
					<Text>{stats.cards.due}</Text>
				</Box>
			</Box>
		</Box>
	)
}
