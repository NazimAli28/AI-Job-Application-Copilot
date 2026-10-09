import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { router } from '@/app/router'
import { ServerWakeBanner } from '@/components/common/server-wake'
import { runtime } from '@/lib/runtime'
import './index.css'

/**
 * Production always talks to apps/api. In dev, the offline prototype (MSW + demo seed in
 * localStorage) takes over only when no API is running (`pnpm dev` alone, or VITE_REAL_API=off).
 */
async function enableMocks() {
  if (import.meta.env.PROD || import.meta.env.VITE_USE_MOCKS === 'false') return
  const { detectRealApi } = await import('./mocks/real-api')
  if (await detectRealApi()) return console.info('[api] using apps/api')
  console.info('[api] API not running · offline prototype (all mocked)')
  const { createWorker } = await import('./mocks/browser')
  await createWorker().start({ onUnhandledFrame: 'bypass', quiet: true })
  runtime.mocks = true
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ServerWakeBanner />
            <RouterProvider router={router} />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
