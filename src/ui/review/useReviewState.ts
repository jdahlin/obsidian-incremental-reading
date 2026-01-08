import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { ReviewScreenActions, ReviewScreenState } from './review-screen-state';
import { ReviewController, type ReviewControllerDeps } from './review-controller';

export interface UseReviewStateResult {
	state: ReviewScreenState;
	actions: ReviewScreenActions;
	onKeyDown: (event: KeyboardEvent) => void;
}

export function useReviewState(deps: ReviewControllerDeps): UseReviewStateResult {
	const controller = useMemo(
		() => new ReviewController(deps),
		[deps.app, deps.view, deps.settings],
	);
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
		(event: KeyboardEvent) => controller.handleKeyDown(event),
		[controller],
	);

	return {
		state,
		actions,
		onKeyDown,
	};
}
