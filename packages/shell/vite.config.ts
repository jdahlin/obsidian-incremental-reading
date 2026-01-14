import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

function devUrlsPlugin(): Plugin {
	return {
		name: 'dev-urls',
		configureServer(server) {
			const original = server.printUrls
			server.printUrls = () => {
				const logger = server.config.logger
				const gatewayUrl = process.env.DEV_GATEWAY_URL
				const webUrl = process.env.DEV_WEB_URL
				const hubUrl = process.env.DEV_HUB_URL
				const apiProxyUrl = process.env.DEV_API_PROXY_URL
				const apiDirectUrl = process.env.DEV_API_URL
				if (!gatewayUrl && !webUrl && !hubUrl && !apiProxyUrl && !apiDirectUrl) {
					original()
					return
				}
				logger.info('')
				const bold = (value: string) => `\u001b[1m${value}\u001b[0m`
				if (gatewayUrl) {
					const appUrl = gatewayUrl.endsWith('/') ? gatewayUrl : `${gatewayUrl}/`
					logger.info(`  ${bold('App:')}      ${appUrl}`)
				}
				if (apiProxyUrl) {
					logger.info(`  ${bold('API:')}      ${apiProxyUrl}`)
				}
				if (hubUrl) {
					logger.info(`  ${bold('Hub:')}      ${hubUrl}`)
				}
				if (webUrl) {
					logger.info(`  ${bold('Web:')}      ${webUrl}`)
				}
			}
		},
	}
}

export default defineConfig({
	plugins: [react(), devUrlsPlugin()],
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
	clearScreen: false,
})
