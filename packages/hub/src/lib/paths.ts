const HUB_PREFIX = '/hub'

const detectHubBase = (): string => {
	if (typeof window === 'undefined') {
		return ''
	}
	const path = window.location.pathname
	return path === HUB_PREFIX || path.startsWith(`${HUB_PREFIX}/`) ? HUB_PREFIX : ''
}

export const withHubBase = (path: string): string => {
	if (path === '') {
		return path
	}
	if (!path.startsWith('/')) {
		return path
	}
	const base = detectHubBase()
	if (base === '') {
		return path
	}
	if (path === '/') {
		return base
	}
	return path.startsWith(`${base}/`) ? path : `${base}${path}`
}
