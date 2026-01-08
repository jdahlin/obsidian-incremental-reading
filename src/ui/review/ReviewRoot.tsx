import type { FunctionalComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { App } from 'obsidian';
import { ReviewScreenRouter } from './ReviewScreenRouter';
import { useReviewState } from './useReviewState';
import type { ReviewSettings } from './review-controller';

export interface ReviewRootProps {
	app: App;
	view: unknown;
	settings: ReviewSettings;
}

export const ReviewRoot: FunctionalComponent<ReviewRootProps> = ({ app, view, settings }) => {
	const { state, actions, onKeyDown } = useReviewState({ app, view, settings });
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		rootRef.current?.focus();
	}, []);

	return (
		<div className="ir-review-root" tabIndex={0} onKeyDown={onKeyDown} ref={rootRef}>
			<ReviewScreenRouter state={state} actions={actions} />
		</div>
	);
};
