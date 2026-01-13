import type { ReviewControllerSettings, ReviewPlatform } from '@repo/core/review'
import type { ReviewScreenActions, ReviewScreenState } from '@repo/core/review/types'
import type { DataStore, NotePlatform } from '@repo/core/types'
import { ReviewController } from '@repo/core/review'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	ApiClient,
	ApiDataStore,
	ApiNotePlatform,
	ApiReviewPlatform,
	WebDataStore,
	WebNotePlatform,
	WebReviewPlatform,
} from './adapters'
import { ReviewRouter } from './components'
import { createDemoData } from './demo-data'

// Check for API URL from environment or default to demo mode
const API_URL = import.meta.env.VITE_API_URL

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

interface Adapters {
	dataStore: DataStore & { clear?: () => void }
	notePlatform: NotePlatform & { clear?: () => void }
	reviewPlatform: ReviewPlatform
	isApiMode: boolean
}

function createAdapters(): Adapters {
	if (API_URL !== undefined && API_URL !== '') {
		const client = new ApiClient(API_URL)
		const dataStore = new ApiDataStore(client)
		const notePlatform = new ApiNotePlatform(client)
		const reviewPlatform = new ApiReviewPlatform(client)
		return { dataStore, notePlatform, reviewPlatform, isApiMode: true }
	}

	// Demo mode with localStorage
	const dataStore = new WebDataStore()
	const notePlatform = new WebNotePlatform()
	const reviewPlatform = new WebReviewPlatform(notePlatform)
	return { dataStore, notePlatform, reviewPlatform, isApiMode: false }
}

export const App = () => {
	const [state, setState] = useState<ReviewScreenState | null>(null)
	const [actions, setActions] = useState<ReviewScreenActions | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Create adapters once
	const adapters = useMemo(() => createAdapters(), [])

	// Initialize controller
	useEffect(() => {
		const initController = async () => {
			try {
				const { dataStore, notePlatform, reviewPlatform, isApiMode } = adapters

				// Only create demo data in demo mode
				if (!isApiMode) {
					const items = await dataStore.listItems()
					if (items.length === 0) {
						createDemoData(dataStore as WebDataStore, notePlatform as WebNotePlatform)
					}
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
				// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DOM type
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
		if (adapters.isApiMode) {
			// In API mode, just reload to refresh from server
			window.location.reload()
		} else {
			// In demo mode, clear localStorage
			adapters.dataStore.clear?.()
			adapters.notePlatform.clear?.()
			window.location.reload()
		}
	}, [adapters])

	if (isLoading) {
		return (
			<div className="web-root">
				<div className="ir-loading">Loading...</div>
			</div>
		)
	}

	if (error !== null) {
		return (
			<div className="web-root">
				<div className="ir-review-app">
					<div className="ir-error">
						<h2>Error</h2>
						<p>{error}</p>
					</div>
				</div>
			</div>
		)
	}

	if (!state || !actions) {
		return (
			<div className="web-root">
				<div className="ir-loading">Initializing...</div>
			</div>
		)
	}

	return (
		<div className="web-root">
			<div className="ir-review-app">
				<header
					style={{
						marginBottom: '1rem',
						display: 'flex',
						justifyContent: 'space-between',
					}}
				>
					<h1 style={{ fontSize: '1.5rem', margin: 0 }}>
						Incremental Reading
						{adapters.isApiMode && (
							<span
								style={{ fontSize: '0.75rem', marginLeft: '0.5rem', opacity: 0.7 }}
							>
								(API)
							</span>
						)}
					</h1>
					<button
						type="button"
						className="ir-btn ir-btn-secondary"
						onClick={handleClearData}
						style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
					>
						{adapters.isApiMode ? 'Refresh' : 'Reset Demo'}
					</button>
				</header>
				<ReviewRouter state={state} actions={actions} />
			</div>
		</div>
	)
}
