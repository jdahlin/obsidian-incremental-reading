import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react()],
	css: {
		postcss: {
			plugins: [
				tailwindcss({
					config: resolve(__dirname, '../hub/tailwind.config.ts'),
				}),
				autoprefixer(),
			],
		},
	},
	resolve: {
		alias: {
			'@repo/core': resolve(__dirname, '../core/src'),
			'@repo/web': resolve(__dirname, '../web/src'),
			'@repo/hub': resolve(__dirname, '../hub/src'),
			'@': resolve(__dirname, '../hub/src'),
		},
	},
	server: {
		fs: {
			allow: [resolve(__dirname, '..')],
		},
		host: true,
		port: 5173,
	},
})
