import type { Buffer } from 'node:buffer'
import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'

import { spawn } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import meow from 'meow'

interface ServeOptions {
	vaultPath: string
	gatewayPort: number
	appPort: number
	apiPort: number
	apiUrl: string
}

function resolveRepoRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
}

function parseServeOptions(argv: readonly string[]): ServeOptions {
	const cli = meow(
		`
  Usage
    $ pnpm dev -- [--vault path]
    $ pnpm cli serve [options]

  Options
    --vault, -v          Path to vault (default: ./anki-vault)
    --gateway-port       Gateway port (default: env GATEWAY_PORT or 8000)
    --app-port           Shell app port (default: env APP_PORT or 5173)
    --api-port           API port (default: env API_PORT or 3001)
    --api-url            API URL for the shell (default: gateway URL)
`,
		{
			importMeta: import.meta,
			argv,
			flags: {
				vault: {
					type: 'string',
					shortFlag: 'v',
					default: './anki-vault',
				},
				gatewayPort: {
					type: 'number',
				},
				appPort: {
					type: 'number',
				},
				apiPort: {
					type: 'number',
				},
				apiUrl: {
					type: 'string',
				},
			},
		},
	)

	const gatewayPort = cli.flags.gatewayPort ?? Number(process.env.GATEWAY_PORT ?? 8000)
	const appPort = cli.flags.appPort ?? Number(process.env.APP_PORT ?? 5173)
	const apiPort = cli.flags.apiPort ?? Number(process.env.API_PORT ?? 3001)
	const apiUrl = cli.flags.apiUrl ?? process.env.WEB_API_URL ?? `http://localhost:${gatewayPort}`

	const repoRoot = resolveRepoRoot()
	const vaultInput = cli.flags.vault
	const vaultPath = vaultInput.startsWith('/') ? vaultInput : resolve(repoRoot, vaultInput)

	return { vaultPath, gatewayPort, appPort, apiPort, apiUrl }
}

function resolveTargetPath(path: Readonly<string>, options: Readonly<ServeOptions>): string {
	if (path.startsWith('/api')) {
		return `http://localhost:${options.apiPort}`
	}
	if (path.startsWith('/hub')) {
		return `http://localhost:${options.appPort}`
	}
	if (path.startsWith('/web')) {
		return `http://localhost:${options.appPort}`
	}
	return `http://localhost:${options.appPort}`
}

function proxyHttp(
	options: Readonly<ServeOptions>,
	req: Readonly<IncomingMessage>,
	res: ServerResponse,
): void {
	const target = resolveTargetPath(req.url ?? '/', options)
	const targetUrl = new URL(target)
	const requester = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
	const proxyReq = requester(
		{
			protocol: targetUrl.protocol,
			hostname: targetUrl.hostname,
			port: targetUrl.port,
			method: req.method,
			path: req.url,
			headers: {
				...req.headers,
				host: targetUrl.host,
			},
		},
		(proxyRes) => {
			res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
			proxyRes.pipe(res)
		},
	)
	proxyReq.on('error', (err) => {
		if (!res.headersSent) {
			res.writeHead(502, { 'Content-Type': 'text/plain' })
		}
		res.end(`Proxy error: ${err.message}`)
	})
	req.pipe(proxyReq)
}

function proxyWs(
	options: Readonly<ServeOptions>,
	req: IncomingMessage,
	socket: Duplex,
	head: Readonly<Buffer>,
): void {
	const target = resolveTargetPath(req.url ?? '/', options)
	const targetUrl = new URL(target)
	const port = Number(targetUrl.port)
	const proxySocket = net.connect(port, targetUrl.hostname, () => {
		let headers = ''
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			const key = req.rawHeaders[i]
			const value = req.rawHeaders[i + 1]
			if (key && value) {
				headers += `${key}: ${value}\r\n`
			}
		}
		const path = req.url ?? '/'
		const requestLine = `${req.method ?? 'GET'} ${path} HTTP/${req.httpVersion}\r\n`
		proxySocket.write(`${requestLine}${headers}\r\n`)
		if (head.length > 0) {
			proxySocket.write(head)
		}
		socket.pipe(proxySocket)
		proxySocket.pipe(socket)
	})

	proxySocket.on('error', () => {
		socket.destroy()
	})
}

export async function runServe(argv: readonly string[]): Promise<void> {
	const repoRoot = resolveRepoRoot()
	const options = parseServeOptions(argv)
	const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
	const gatewayUrl = `http://localhost:${options.gatewayPort}`
	const webUrl = `${gatewayUrl}/web`
	const hubUrl = `${gatewayUrl}/hub`
	const apiProxyUrl = `${gatewayUrl}/api`
	const apiDirectUrl = `http://localhost:${options.apiPort}`

	const processes: ChildProcess[] = []
	let isShuttingDown = false
	let server: ReturnType<typeof createServer> | null = null

	function startProcess(
		name: string,
		args: readonly string[],
		env: Record<string, string> = {},
		stdio: StdioOptions = 'inherit',
	) {
		const child: ChildProcess = spawn(pnpmCmd, args, {
			cwd: repoRoot,
			env: { ...process.env, ...env },
			stdio,
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

	startProcess(
		'api-backend',
		['--filter', '@repo/api-backend', 'dev'],
		{
			VAULT_PATH: options.vaultPath,
			PORT: String(options.apiPort),
		},
		['ignore', 'ignore', 'inherit'],
	)
	startProcess(
		'shell',
		['--silent', '--filter', '@repo/shell', 'dev'],
		{
			BROWSER: 'open',
			DEV_GATEWAY_URL: gatewayUrl,
			DEV_WEB_URL: webUrl,
			DEV_HUB_URL: hubUrl,
			DEV_API_PROXY_URL: apiProxyUrl,
			DEV_API_URL: apiDirectUrl,
			VITE_API_URL: options.apiUrl,
		},
		'inherit',
	)

	server = createServer((req, res) => {
		proxyHttp(options, req, res)
	})

	server.on('upgrade', (req, socket, head) => {
		proxyWs(options, req, socket, head)
	})

	server.listen(options.gatewayPort)

	process.on('SIGINT', () => shutdown(0))
	process.on('SIGTERM', () => shutdown(0))
}
