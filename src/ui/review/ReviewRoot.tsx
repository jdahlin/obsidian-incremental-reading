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

	useEffect(() => {
		const handler = (event: KeyboardEvent): void => {
			const root = rootRef.current;
			if (!root) return;
			const target = event.target as Node | null;
			if (target && !root.contains(target)) return;
			onKeyDown(event);
		};
		window.addEventListener('keydown', handler, true);
		return () => {
			window.removeEventListener('keydown', handler, true);
		};
	}, [onKeyDown]);

	return (
		<div className="ir-review-root" tabIndex={0} ref={rootRef}>
			<ReviewScreenRouter state={state} actions={actions} />
		</div>
	);
};
