import type { ReviewControllerSettings } from '@repo/core/review'
import type { ReviewScreenActions, ReviewScreenState } from '@repo/core/review/types'
import { ReviewController } from '@repo/core/review'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { WebDataStore, WebNotePlatform, WebReviewPlatform } from './adapters'
import { ReviewRouter } from './components'
import { createDemoData } from './demo-data'

const defaultSettings: ReviewControllerSettings = {
	newCardsPerDay: 20,
	maximumInterval: 365,
	requestRetention: 0.9,
	extractTag: '#extract',
	showStreak: true,
	strategy: 'Anki',
	clumpLimit: 3,
	cooldown: 5,
}

export const App = () => {
	const [state, setState] = useState<ReviewScreenState | null>(null)
	const [actions, setActions] = useState<ReviewScreenActions | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Create adapters once
	const adapters = useMemo(() => {
		const dataStore = new WebDataStore()
		const notePlatform = new WebNotePlatform()
		const reviewPlatform = new WebReviewPlatform(notePlatform)
		return { dataStore, notePlatform, reviewPlatform }
	}, [])

	// Initialize controller
	useEffect(() => {
		const initController = async () => {
			try {
				const { dataStore, notePlatform, reviewPlatform } = adapters

				// Check if we have data, if not create demo data
				const items = await dataStore.listItems()
				if (items.length === 0) {
					createDemoData(dataStore, notePlatform)
				}

				const controller = new ReviewController({
					platform: reviewPlatform,
					settings: defaultSettings,
					dataStore,
					notePlatform,
				})

				controller.mount()
				controller.subscribe((newState) => {
					setState(newState)
				})
				setActions(controller.getActions())

				// Initial refresh
				await controller.refreshSummary()
				setIsLoading(false)

				// Handle keyboard events
				const handleKeyDown = (event: KeyboardEvent) => {
					// Adapt DOM KeyboardEvent to KeyDownEvent interface
					const target = event.target as HTMLElement | null
					void controller.handleKeyDown({
						key: event.key,
						defaultPrevented: event.defaultPrevented,
						ctrlKey: event.ctrlKey,
						target: target ? { tagName: target.tagName } : null,
						preventDefault: () => event.preventDefault(),
					})
				}
				window.addEventListener('keydown', handleKeyDown)

				return () => {
					window.removeEventListener('keydown', handleKeyDown)
					controller.unmount()
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error')
				setIsLoading(false)
			}
		}

		void initController()
	}, [adapters])

	const handleClearData = useCallback(() => {
		adapters.dataStore.clear()
		adapters.notePlatform.clear()
		window.location.reload()
	}, [adapters])

	if (isLoading) {
		return <div className="ir-loading">Loading...</div>
	}

	if (error !== null) {
		return (
			<div className="ir-review-app">
				<div className="ir-error">
					<h2>Error</h2>
					<p>{error}</p>
				</div>
			</div>
		)
	}

	if (!state || !actions) {
		return <div className="ir-loading">Initializing...</div>
	}

	return (
		<div className="ir-review-app">
			<header
				style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}
			>
				<h1 style={{ fontSize: '1.5rem', margin: 0 }}>Incremental Reading</h1>
				<button
					type="button"
					className="ir-btn ir-btn-secondary"
					onClick={handleClearData}
					style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
				>
					Reset Demo
				</button>
			</header>
			<ReviewRouter state={state} actions={actions} />
		</div>
	)
}
