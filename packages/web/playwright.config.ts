import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false, // Run tests sequentially for stability
	forbidOnly: process.env.CI !== undefined && process.env.CI !== '',
	retries: process.env.CI !== undefined && process.env.CI !== '' ? 2 : 0,
	workers: 1, // Single worker for stability
	reporter: 'html',
	timeout: 60000, // Increase test timeout
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: process.env.CI === undefined || process.env.CI === '',
		timeout: 120000,
	},
})
