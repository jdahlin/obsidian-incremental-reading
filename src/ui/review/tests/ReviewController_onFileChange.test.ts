import { describe, expect, it } from 'vitest';
import { App, type TAbstractFile } from 'obsidian';
import { ReviewController } from '../review-controller';
import { TFile } from '../../../tests/obsidian-stub';

// Define the shape of private members we need to access for testing
interface TestableReviewController {
	model: { screen: string };
	onFileChange(file: TAbstractFile): void;
	refreshSummary(): Promise<void>;
}

// Helper to access private method
function triggerFileChange(controller: ReviewController, path: string) {
	const file = new TFile(path, null) as unknown as TAbstractFile;
	(controller as unknown as TestableReviewController).onFileChange(file);
}

// Helper to set screen state manually if needed,
// though we can just call startReview() to get into review mode.
// However, startReview requires data.
// We can also just hack the model state for this specific test
// since we only care about the guard clause in onFileChange.

describe('ReviewController - onFileChange', () => {
	it('should NOT refresh summary (reset to folder) if screen is review', async () => {
		const app = new App();
		const controller = new ReviewController({
			app,
			view: {},
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		// 1. Manually set state to review to simulate active session
		// We use type casting to access private model
		(controller as unknown as TestableReviewController).model.screen = 'review';

		// 2. Trigger file change on a review item
		triggerFileChange(controller, 'IR/Review Items/some-item.md');

		// 3. Wait for timeout (500ms in code)
		await new Promise((resolve) => setTimeout(resolve, 600));

		// 4. Assert screen is STILL review
		expect((controller as unknown as TestableReviewController).model.screen).toBe('review');
	});

	it('should refresh summary if screen is folder', async () => {
		const app = new App();
		const controller = new ReviewController({
			app,
			view: {},
			settings: {
				newCardsPerDay: 10,
				maximumInterval: 30,
				requestRetention: 0.9,
				extractTag: 'topic',
				trackReviewTime: false,
				showStreak: true,
			},
		});

		// 1. Ensure state is folder
		(controller as unknown as TestableReviewController).model.screen = 'folder';

		// We want to verify refreshSummary is called.
		// We can spy on it.
		let called = false;
		const testableController = controller as unknown as TestableReviewController;
		testableController.refreshSummary = async () => {
			called = true;
		};

		// 2. Trigger file change
		triggerFileChange(controller, 'IR/Review Items/some-item.md');

		// 3. Wait for timeout
		await new Promise((resolve) => setTimeout(resolve, 600));

		// 4. Assert refreshSummary was called
		expect(called).toBe(true);
	});
});
