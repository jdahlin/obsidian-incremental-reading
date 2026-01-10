import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	fullyParallel: false, // Obsidian can only run one instance at a time
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		trace: 'on-first-retry',
		video: 'on-first-retry',
	},
});
