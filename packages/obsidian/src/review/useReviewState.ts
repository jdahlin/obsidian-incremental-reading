import type { ReviewPlatformAdapter } from '@repo/core/core/types';
import type { DataStore, NotePlatform } from '@repo/core/types';
import type { EngineReviewControllerDeps, EngineReviewSettings } from '../adapters';
import type { ReviewScreenActions, ReviewScreenState } from './review-screen-state';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { EngineReviewController } from '../adapters';

export interface UseReviewStateResult {
	state: ReviewScreenState;
	actions: ReviewScreenActions;
	onKeyDown: (event: KeyboardEvent) => void;
}

export interface UseReviewStateDeps {
	platform: ReviewPlatformAdapter;
	settings: EngineReviewSettings;
	dataStore: DataStore;
	notePlatform: NotePlatform;
}

export function useReviewState(deps: UseReviewStateDeps): UseReviewStateResult {
	const controller = useMemo(() => {
		const engineDeps: EngineReviewControllerDeps = {
			platform: deps.platform,
			settings: deps.settings,
			dataStore: deps.dataStore,
			notePlatform: deps.notePlatform,
		};
		return new EngineReviewController(engineDeps);
	}, [deps.platform, deps.settings, deps.dataStore, deps.notePlatform]);

	const [state, setState] = useState<ReviewScreenState>(controller.getState());

	useEffect(() => {
		controller.mount();
		const unsubscribe = controller.subscribe(setState);
		void controller.refreshSummary();
		return () => {
			unsubscribe();
			controller.unmount();
		};
	}, [controller]);

	const actions = useMemo<ReviewScreenActions>(() => controller.getActions(), [controller]);
	const onKeyDown = useCallback(
		(event: KeyboardEvent) => {
			void controller.handleKeyDown(event);
		},
		[controller],
	);

	return {
		state,
		actions,
		onKeyDown,
	};
}
