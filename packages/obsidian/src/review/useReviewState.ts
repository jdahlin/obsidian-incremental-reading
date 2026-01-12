import type { ReviewPlatformAdapter } from '@repo/core/core/types'
import type { DataStore, NotePlatform } from '@repo/core/types'
import type { EngineReviewControllerDeps, EngineReviewSettings } from '../adapters'
import type { ReviewScreenActions, ReviewScreenState } from './review-screen-state'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { EngineReviewController } from '../adapters'

export interface UseReviewStateResult {
	state: ReviewScreenState
	actions: ReviewScreenActions
	// eslint-disable-next-line ts/prefer-readonly-parameter-types -- DOM type
	onKeyDown: (event: KeyboardEvent) => void
	controller: EngineReviewController
}

export interface UseReviewStateDeps {
	platform: ReviewPlatformAdapter
	settings: EngineReviewSettings
	dataStore: DataStore
	notePlatform: NotePlatform
}

// eslint-disable-next-line ts/prefer-readonly-parameter-types -- deps contains complex types
export function useReviewState(deps: UseReviewStateDeps): UseReviewStateResult {
	const controller = useMemo(() => {
		const engineDeps: EngineReviewControllerDeps = {
			platform: deps.platform,
			settings: deps.settings,
			dataStore: deps.dataStore,
			notePlatform: deps.notePlatform,
		}
		return new EngineReviewController(engineDeps)
	}, [deps.platform, deps.settings, deps.dataStore, deps.notePlatform])

	const [state, setState] = useState<ReviewScreenState>(controller.getState())

	useEffect(() => {
		controller.mount()
		const unsubscribe = controller.subscribe((state) => setState(state as ReviewScreenState))
		void controller.refreshSummary()
		return () => {
			unsubscribe()
			controller.unmount()
		}
	}, [controller])

	const actions = useMemo<ReviewScreenActions>(() => controller.getActions(), [controller])
	/* eslint-disable ts/prefer-readonly-parameter-types -- DOM type */
	const onKeyDown = useCallback(
		(event: KeyboardEvent) => {
			/* eslint-enable ts/prefer-readonly-parameter-types */
			void controller.handleKeyDown(event)
		},
		[controller],
	)

	return {
		state,
		actions,
		onKeyDown,
		controller,
	}
}
