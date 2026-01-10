import type { FunctionalComponent } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { App } from 'obsidian';
import { ReviewScreenRouter } from './ReviewScreenRouter';
import { useReviewState, type UseReviewStateDeps } from './useReviewState';
import { ObsidianReviewAdapter } from './obsidian-adapter';
import { ObsidianVault, ObsidianNotePlatform } from '../adapters';
import { MarkdownDataStore } from '../../engine/data/MarkdownDataStore';
import type { IncrementalReadingSettings } from '../../settings';

export interface ReviewRootProps {
	app: App;
	view: unknown;
	settings: IncrementalReadingSettings;
}

export const ReviewRoot: FunctionalComponent<ReviewRootProps> = ({ app, view, settings }) => {
	const platform = useMemo(() => new ObsidianReviewAdapter(app, view), [app, view]);

	// Create engine adapters using the unified MarkdownDataStore
	const vault = useMemo(() => new ObsidianVault(app), [app]);
	const notePlatform = useMemo(() => new ObsidianNotePlatform(app), [app]);
	const dataStore = useMemo(
		() => new MarkdownDataStore(vault, notePlatform),
		[vault, notePlatform],
	);

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
	);

	const { state, actions, onKeyDown } = useReviewState(deps);
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
