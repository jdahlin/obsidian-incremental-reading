import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { App } from 'obsidian';
import { ReviewController } from '../review-controller';
import { ObsidianReviewAdapter } from '../obsidian-adapter';

// Define the shape of private members we need to access for testing
interface TestableReviewController {
	model: { screen: string };
	refreshSummary(): Promise<void>;
	mount(): void;
}

describe('ReviewController - onDataChange', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should NOT refresh summary if screen is review', async () => {
		const app = new App();
		const platform = new ObsidianReviewAdapter(app, {});
		const controller = new ReviewController({
			platform,
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		const testable = controller as unknown as TestableReviewController;

		// 1. Manually set state to review to simulate active session
		testable.model.screen = 'review';

		// Capture the handler
		let dataChangeHandler: () => void = () => {};
		vi.spyOn(platform, 'onDataChange').mockImplementation((handler) => {
			dataChangeHandler = handler;
			return () => {};
		});

		testable.mount();

		// 2. Trigger data change
		dataChangeHandler();

		// 3. Advance timers past the 500ms debounce
		await vi.advanceTimersByTimeAsync(600);

		// 4. Assert screen is STILL review
		expect(testable.model.screen).toBe('review');
	});

	it('should refresh summary if screen is folder', async () => {
		const app = new App();
		const platform = new ObsidianReviewAdapter(app, {});
		const controller = new ReviewController({
			platform,
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		const testable = controller as unknown as TestableReviewController;

		// 1. Ensure state is folder
		testable.model.screen = 'folder';

		// Capture the handler
		let dataChangeHandler: () => void = () => {};
		vi.spyOn(platform, 'onDataChange').mockImplementation((handler) => {
			dataChangeHandler = handler;
			return () => {};
		});

		const refreshSpy = vi
			.spyOn(controller, 'refreshSummary')
			.mockImplementation(async () => {});

		testable.mount();

		// 2. Trigger data change
		dataChangeHandler();

		// 3. Advance timers past the 500ms debounce
		await vi.advanceTimersByTimeAsync(600);

		// 4. Assert refreshSummary was called
		expect(refreshSpy).toHaveBeenCalled();
	});
});
