import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router'
import { PageSkeleton } from '@/components/common/states'
import { useMe } from '@/features/auth/api'
import { AppShell } from './shell'

/** Lazy-load a named page export so each feature is its own chunk. */
function page<M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M) {
  const C = lazy(async () => ({ default: (await load())[name] as ComponentType }))
  return (
    <Suspense fallback={<PageSkeleton />}>
      <C />
    </Suspense>
  )
}

const auth = () => import('@/features/auth/pages')
const analyze = () => import('@/features/analyze')
const jobs = () => import('@/features/jobs')
const interviews = () => import('@/features/interviews')
const settings = () => import('@/features/settings')

function RequireAuth() {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  if (isPending) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * Logged-in users leave the auth pages. This also performs the post-register redirect (the
 * auth pages unmount as soon as the session is cached): register → onboarding, login → `from`.
 */
function GuestOnly() {
  const { data: user, isPending } = useMe()
  const { pathname, state } = useLocation()
  if (isPending) return <FullPageLoader />
  if (!user) return <Outlet />
  const from = (state as { from?: string } | null)?.from
  const to = pathname === '/register' ? '/app/onboarding' : (from ?? '/app/dashboard')
  return <Navigate to={to} replace />
}

function FullPageLoader() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <PageSkeleton rows={2} />
    </div>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: page(() => import('@/features/landing'), 'LandingPage') },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: page(auth, 'LoginPage') },
      { path: '/register', element: page(auth, 'RegisterPage') },
      { path: '/forgot-password', element: page(auth, 'ForgotPasswordPage') },
    ],
  },
  { path: '/reset-password', element: page(auth, 'ResetPasswordPage') },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      { path: 'onboarding', element: page(() => import('@/features/onboarding'), 'OnboardingPage') },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: page(() => import('@/features/dashboard'), 'DashboardPage') },
          { path: 'analyze', element: page(analyze, 'AnalyzePage') },
          { path: 'analyze/:analysisId', element: page(analyze, 'AnalysisResultPage') },
          { path: 'profile', element: page(() => import('@/features/profile'), 'ProfilePage') },
          { path: 'resume', element: page(() => import('@/features/resume'), 'ResumePage') },
          { path: 'jobs', element: page(jobs, 'JobsPage') },
          // D9: applications merged into jobs. "+ Add job" is a dialog (?add=1).
          { path: 'jobs/new', element: <Navigate to="/app/jobs?add=1" replace /> },
          { path: 'jobs/:jobId', element: page(jobs, 'JobDetailPage') },
          { path: 'applications/*', element: <Navigate to="/app/jobs" replace /> },
          { path: 'interviews', element: page(interviews, 'InterviewsPage') },
          { path: 'interviews/:sessionId', element: page(interviews, 'InterviewSessionPage') },
          { path: 'analytics', element: page(() => import('@/features/analytics'), 'AnalyticsPage') },
          { path: 'settings', element: page(settings, 'SettingsPage') },
          { path: 'admin', element: page(settings, 'AdminPage') },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
