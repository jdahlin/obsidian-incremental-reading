import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

// Helper to wait for the app to fully initialize
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- Playwright type
async function waitForAppReady(page: Page) {
	// Wait for the main app container to be visible
	await page.waitForSelector('.ir-review-app', { timeout: 15000 })
	// Wait for either loading to finish or content to appear
	await page.waitForFunction(
		() => {
			const loading = document.querySelector('.ir-loading')
			const content = document.querySelector('.ir-review-screen')
			return !loading || content
		},
		{ timeout: 15000 },
	)
}

test.describe('review flow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage and navigate fresh
		await page.goto('/')
		await page.evaluate(() => localStorage.clear())
		await page.reload()
		await waitForAppReady(page)
	})

	test('displays folder screen with demo data', async ({ page }) => {
		// App should be loaded from beforeEach
		// Should show main heading
		await expect(page.locator('h1')).toContainText('Incremental Reading')

		// Should show "Review Decks" section
		await expect(page.locator('h2')).toContainText('Review Decks')

		// Should show "All Decks" option
		await expect(page.getByText('All Decks')).toBeVisible()

		// Should show Study button
		await expect(page.getByRole('button', { name: /Study/ })).toBeVisible()
	})

	test('shows session stats on folder screen', async ({ page }) => {
		// Should show today reviewed count
		await expect(page.getByText('Today reviewed:')).toBeVisible()

		// Should show new, learning, due counts
		await expect(page.getByText('New:')).toBeVisible()
		await expect(page.getByText('Learning:')).toBeVisible()
		await expect(page.getByText('Due:')).toBeVisible()
	})

	test('starts review session when clicking Study', async ({ page }) => {
		// Click Study button
		const studyButton = page.getByRole('button', { name: /Study/ })
		await expect(studyButton).toBeEnabled()
		await studyButton.click()

		// Should transition to question screen
		await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible({
			timeout: 10000,
		})
	})

	test('shows answer when clicking Show Answer', async ({ page }) => {
		// Start review
		await page.getByRole('button', { name: /Study/ }).click()

		// Wait for question screen
		await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible({
			timeout: 10000,
		})

		// Click Show Answer
		await page.getByRole('button', { name: 'Show Answer' }).click()

		// Should show grade buttons
		await expect(page.locator('.ir-grade-buttons')).toBeVisible()
		await expect(page.locator('[data-grade="1"]')).toBeVisible()
		await expect(page.locator('[data-grade="2"]')).toBeVisible()
		await expect(page.locator('[data-grade="3"]')).toBeVisible()
		await expect(page.locator('[data-grade="4"]')).toBeVisible()
	})

	test('grades card and continues review', async ({ page }) => {
		// Start review
		await page.getByRole('button', { name: /Study/ }).click()
		await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible({
			timeout: 10000,
		})

		// Show answer
		await page.getByRole('button', { name: 'Show Answer' }).click()
		await expect(page.locator('.ir-grade-buttons')).toBeVisible()

		// Grade with "Good" (3)
		await page.locator('[data-grade="3"]').click()

		// Should either show next question or finished screen
		await page.waitForTimeout(500) // Allow state to update

		const hasShowAnswer = await page
			.getByRole('button', { name: 'Show Answer' })
			.isVisible()
			.catch(() => false)
		const hasFinished = await page
			.locator('.ir-finished-title')
			.isVisible()
			.catch(() => false)

		expect(hasShowAnswer || hasFinished).toBe(true)
	})

	test('completes review session and shows finished screen', async ({ page }) => {
		// Start review
		await page.getByRole('button', { name: /Study/ }).click()

		// Review all cards with "Easy" to quickly finish
		let iterations = 0
		const maxIterations = 30

		while (iterations < maxIterations) {
			iterations++

			// Check if finished
			const finishedTitle = page.locator('.ir-finished-title')
			if (await finishedTitle.isVisible().catch(() => false)) {
				break
			}

			// Show answer if on question screen
			const showAnswerBtn = page.getByRole('button', { name: 'Show Answer' })
			if (await showAnswerBtn.isVisible().catch(() => false)) {
				await showAnswerBtn.click()
			}

			// Grade with "Easy" (4)
			const easyBtn = page.locator('[data-grade="4"]')
			if (await easyBtn.isVisible().catch(() => false)) {
				await easyBtn.click()
				await page.waitForTimeout(200)
			}
		}

		// Should show finished screen
		await expect(page.locator('.ir-finished-title')).toBeVisible({ timeout: 10000 })
		await expect(page.getByText('Done!')).toBeVisible()
		await expect(page.getByText('Reviewed:')).toBeVisible()
	})

	test('returns to folder screen after finishing', async ({ page }) => {
		// Start and complete review
		await page.getByRole('button', { name: /Study/ }).click()

		let iterations = 0
		while (iterations < 30) {
			iterations++
			if (
				await page
					.locator('.ir-finished-title')
					.isVisible()
					.catch(() => false)
			)
				break

			const showAnswerBtn = page.getByRole('button', { name: 'Show Answer' })
			if (await showAnswerBtn.isVisible().catch(() => false)) {
				await showAnswerBtn.click()
			}

			const easyBtn = page.locator('[data-grade="4"]')
			if (await easyBtn.isVisible().catch(() => false)) {
				await easyBtn.click()
				await page.waitForTimeout(200)
			}
		}

		// Click "Back to decks"
		await expect(page.getByRole('button', { name: 'Back to decks' })).toBeVisible()
		await page.getByRole('button', { name: 'Back to decks' }).click()

		// Should return to folder screen
		await expect(page.locator('h2')).toContainText('Review Decks')
	})

	test('reset demo button clears data', async ({ page }) => {
		// Click Reset Demo button
		await page.getByRole('button', { name: 'Reset Demo' }).click()

		// Page should reload and show fresh demo data
		await waitForAppReady(page)
		await expect(page.locator('h2')).toContainText('Review Decks')
	})

	test('keyboard navigation works', async ({ page }) => {
		// Start review
		await page.getByRole('button', { name: /Study/ }).click()
		await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible({
			timeout: 10000,
		})

		// Press space to show answer
		await page.keyboard.press('Space')

		// Should show grade buttons
		await expect(page.locator('.ir-grade-buttons')).toBeVisible()

		// Press 3 for Good
		await page.keyboard.press('Digit3')

		// Should have processed the grade (either next card or finished)
		await page.waitForTimeout(300)
	})
})

test.describe('review card content', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
		await page.evaluate(() => localStorage.clear())
		await page.reload()
		await page.waitForSelector('.ir-review-app', { timeout: 15000 })
	})

	test('displays review card with content', async ({ page }) => {
		// Start review
		await page.getByRole('button', { name: /Study/ }).click()

		// Wait for question screen
		await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible({
			timeout: 10000,
		})

		// Should have a review card
		await expect(page.locator('.ir-review-card')).toBeVisible()
	})
})
