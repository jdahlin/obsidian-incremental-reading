#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const gatewayPort = Number(process.env.GATEWAY_PORT ?? 8000)
const appPort = Number(process.env.APP_PORT ?? 5173)
const apiPort = Number(process.env.API_PORT ?? 3001)

const vaultPathInput = process.env.VAULT_PATH ?? process.argv[2]
if (!vaultPathInput) {
	console.error('Usage: pnpm dev -- <vault-path> (or set VAULT_PATH)')
	process.exit(1)
}

const vaultPath = vaultPathInput.startsWith('/')
	? vaultPathInput
	: resolve(repoRoot, vaultPathInput)
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const processes = []
let isShuttingDown = false
let server = null

function startProcess(name, args, env = {}) {
	const child = spawn(pnpmCmd, args, {
		cwd: repoRoot,
		env: { ...process.env, ...env },
		stdio: 'inherit',
	})
	processes.push(child)
	child.on('exit', (code) => {
		if (isShuttingDown) {
			return
		}
		console.error(`${name} exited with code ${code ?? 'unknown'}`)
		shutdown(1)
	})
	return child
}

function shutdown(code = 0) {
	isShuttingDown = true
	for (const child of processes) {
		child.kill('SIGTERM')
	}
	if (server) {
		server.close(() => {
			process.exit(code)
		})
	} else {
		process.exit(code)
	}
}

const apiUrl = process.env.WEB_API_URL ?? `http://localhost:${gatewayPort}`

startProcess('api-backend', ['--filter', '@repo/api-backend', 'dev'], {
	VAULT_PATH: vaultPath,
	PORT: String(apiPort),
})
startProcess('shell', ['--filter', '@repo/shell', 'dev'], {
	VITE_API_URL: apiUrl,
})

const proxy = httpProxy.createProxyServer({ xfwd: true, ws: true })

proxy.on('error', (err, _req, res) => {
	if (!res.headersSent) {
		res.writeHead(502, { 'Content-Type': 'text/plain' })
	}
	res.end(`Proxy error: ${err.message}`)
})

function resolveTarget(req) {
	const path = req.url ?? '/'
	if (path.startsWith('/api')) {
		return `http://localhost:${apiPort}`
	}
	if (path.startsWith('/hub')) {
		return `http://localhost:${appPort}`
	}
	if (path.startsWith('/web')) {
		return `http://localhost:${appPort}`
	}
	return `http://localhost:${appPort}`
}

server = createServer((req, res) => {
	const target = resolveTarget(req)
	proxy.web(req, res, { target })
})

server.on('upgrade', (req, socket, head) => {
	const target = resolveTarget(req)
	proxy.ws(req, socket, head, { target })
})

server.listen(gatewayPort, () => {
	console.log('Dev gateway ready')
	console.log(`  Web:      http://localhost:${gatewayPort}/web`)
	console.log(`  Hub:      http://localhost:${gatewayPort}/hub`)
	console.log(`  API:      http://localhost:${gatewayPort}/api`)
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
