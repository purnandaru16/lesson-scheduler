import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { useAuth } from '@/features/auth/auth'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LessonTimesPage } from '@/features/lesson-times/LessonTimesPage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { TeachersPage } from '@/features/teachers/TeachersPage'
import { SchedulePage } from '@/features/schedule/SchedulePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Loading…</div>
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="lesson-times" element={<LessonTimesPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </QueryClientProvider>
  )
}
