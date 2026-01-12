import type { DeepReadonly } from '@repo/core/core/readonly'
import type { App } from 'obsidian'
import type { FunctionalComponent } from 'preact'
import type { EngineReviewController } from '../adapters'
import type { IncrementalReadingSettings } from '../settings'
import type { UseReviewStateDeps } from './useReviewState'
import { MarkdownDataStore } from '@repo/core/data/MarkdownDataStore'
import { useEffect, useMemo, useRef } from 'preact/hooks'
import { ObsidianNotePlatform, ObsidianVault } from '../adapters'
import { ObsidianReviewAdapter } from './obsidian-adapter'
import { ReviewScreenRouter } from './ReviewScreenRouter'
import { useReviewState } from './useReviewState'

interface ReviewRootProps {
	app: App
	view: unknown
	settings: DeepReadonly<IncrementalReadingSettings>
	/** Callback when the controller is ready, for Obsidian navigation integration */
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- Controller is mutable
	onControllerReady?: (controller: EngineReviewController) => void
}

export const ReviewRoot: FunctionalComponent<ReviewRootProps> = ({
	app,
	view,
	settings,
	onControllerReady,
}) => {
	const platform = useMemo(() => new ObsidianReviewAdapter(app, view), [app, view])

	// Create engine adapters using the unified MarkdownDataStore
	const vault = useMemo(() => new ObsidianVault(app), [app])
	const notePlatform = useMemo(() => new ObsidianNotePlatform(app), [app])
	const dataStore = useMemo(
		() => new MarkdownDataStore(vault, notePlatform),
		[vault, notePlatform],
	)

	// Map IncrementalReadingSettings to engine settings
	const deps: UseReviewStateDeps = useMemo(
		() => ({
			platform,
			settings: {
				newCardsPerDay: settings.newCardsPerDay,
				maximumInterval: settings.maximumInterval,
				requestRetention: settings.requestRetention,
				extractTag: settings.extractTag,
				trackReviewTime: settings.trackReviewTime,
				showStreak: settings.showStreak,
				strategy: settings.queueStrategy,
				clumpLimit: settings.clumpLimit,
				cooldown: settings.cooldown,
			},
			dataStore,
			notePlatform,
		}),
		[platform, settings, dataStore, notePlatform],
	)

	const { state, actions, onKeyDown, controller } = useReviewState(deps)
	const rootRef = useRef<HTMLDivElement | null>(null)

	const focusRoot = (): void => {
		const root = rootRef.current
		if (!root) return
		try {
			root.focus({ preventScroll: true })
		} catch {
			root.focus()
		}
	}

	useEffect(() => {
		focusRoot()
	}, [])

	// Focus the root when entering review mode (question or answer screen)
	useEffect(() => {
		if (state.type === 'question' || state.type === 'answer') {
			// Use requestAnimationFrame to ensure DOM is ready before focusing
			requestAnimationFrame(() => {
				focusRoot()
			})
		}
	}, [state.type])

	// Notify parent when controller is ready
	useEffect(() => {
		if (onControllerReady) {
			onControllerReady(controller)
		}
	}, [controller, onControllerReady])

	useEffect(() => {
		/* eslint-disable ts/prefer-readonly-parameter-types -- DOM types */
		const handler = (event: Event): void => {
			/* eslint-enable ts/prefer-readonly-parameter-types */
			const keyboardEvent = event as KeyboardEvent
			const root = rootRef.current
			if (root === null) return

			// Skip if target is an input element (user is typing)
			const target = keyboardEvent.target as HTMLElement | null
			if (target !== null) {
				const tagName = target.tagName.toLowerCase()
				if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
					return
				}
				// Skip if inside a modal or command palette
				if (
					target.closest('.modal-container') !== null ||
					target.closest('.prompt') !== null
				) {
					return
				}
			}

			onKeyDown(keyboardEvent)

			// Refocus the review container after handling keys to ensure
			// subsequent keypresses are captured properly
			if (keyboardEvent.defaultPrevented) {
				root.focus({ preventScroll: true })
			}
		}
		window.addEventListener('keydown', handler, true)
		return () => {
			window.removeEventListener('keydown', handler, true)
		}
	}, [onKeyDown])

	return (
		<div className="ir-review-root" tabIndex={0} ref={rootRef} onPointerDownCapture={focusRoot}>
			<ReviewScreenRouter state={state} actions={actions} />
		</div>
	)
}
