import type { Pool } from 'pg'

export function requirePool(getPool: () => Pool | null): Pool {
	const pool = getPool()
	if (!pool) {
		throw new Error('Missing CONTENT_SCANNER_DSN')
	}
	return pool
}
