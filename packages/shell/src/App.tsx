import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const WebApp = lazy(async () => {
	const mod = await import('@repo/web')
	return { default: mod.WebApp }
})

const HubApp = lazy(async () => {
	const mod = await import('@repo/hub')
	return { default: mod.HubApp }
})

export const App = () => (
	<Suspense fallback={<div>Loading...</div>}>
		<Routes>
			<Route path="/" element={<Navigate to="/hub" replace />} />
			<Route path="/web/*" element={<WebApp />} />
			<Route path="/hub/*" element={<HubApp />} />
		</Routes>
	</Suspense>
)
