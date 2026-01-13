import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import CoursePage from './pages/CoursePage'
import CourseDashboard from './pages/CourseDashboard'
import ModuleDashboard from './pages/ModuleDashboard'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient()

const App = () => (
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<Toaster />
			<Routes>
				{/* Redirect root to default course */}
				<Route index element={<Navigate to="courses/LPG002" replace />} />

				{/* Course dashboard */}
				<Route path="courses/:courseCode" element={<CourseDashboard />} />

				{/* Module dashboard */}
				<Route path="courses/:courseCode/:moduleId" element={<ModuleDashboard />} />

				{/* Course lectures list */}
				<Route path="courses/:courseCode/:moduleId/lectures" element={<CoursePage />} />

				{/* Specific lecture */}
				<Route
					path="courses/:courseCode/:moduleId/lectures/:lectureNumber"
					element={<CoursePage />}
				/>

				{/* Catch-all */}
				<Route path="*" element={<NotFound />} />
			</Routes>
		</TooltipProvider>
	</QueryClientProvider>
)

export default App
