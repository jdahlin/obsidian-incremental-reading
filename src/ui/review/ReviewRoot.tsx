import type { FunctionalComponent } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { App } from 'obsidian';
import { ReviewScreenRouter } from './ReviewScreenRouter';
import { useReviewState } from './useReviewState';
import type { ReviewSettings } from './review-controller';
import { ObsidianReviewAdapter } from './obsidian-adapter';

export interface ReviewRootProps {
	app: App;
	view: unknown;
	settings: ReviewSettings;
}

export const ReviewRoot: FunctionalComponent<ReviewRootProps> = ({ app, view, settings }) => {
	const platform = useMemo(() => new ObsidianReviewAdapter(app, view), [app, view]);
	const { state, actions, onKeyDown } = useReviewState({ platform, settings });
	const rootRef = useRef<HTMLDivElement | null>(null);

	const focusRoot = (): void => {
		const root = rootRef.current;
		if (!root) return;
		try {
			root.focus({ preventScroll: true });
		} catch {
			root.focus();
		}
	};

	useEffect(() => {
		focusRoot();
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
		<div className="ir-review-root" tabIndex={0} ref={rootRef} onPointerDownCapture={focusRoot}>
			<ReviewScreenRouter state={state} actions={actions} />
		</div>
	);
};
