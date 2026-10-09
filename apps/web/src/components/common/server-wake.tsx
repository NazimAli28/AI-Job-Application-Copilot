import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { runtime } from '@/lib/runtime'

/** Serverless cold start (and Neon waking from auto-suspend) can take a few seconds on free tiers. */
const SHOW_AFTER_MS = 3000
const RETRY_MS = 3000

/**
 * Cold-start notice: probes `/api/health` once at boot and, if the API hasn't answered within
 * 3 s, explains the wait instead of leaving a blank spinner. Hides itself once the API is up.
 */
export function ServerWakeBanner() {
  const [waking, setWaking] = useState(false)

  useEffect(() => {
    if (runtime.mocks) return
    let done = false
    const timer = window.setTimeout(() => !done && setWaking(true), SHOW_AFTER_MS)
    const probe = async () => {
      while (!done) {
        try {
          const res = await fetch('/api/health', { signal: AbortSignal.timeout(75_000) })
          if (res.ok) break
        } catch {
          // still booting (proxy timeout / network error) — try again
        }
        await new Promise((r) => setTimeout(r, RETRY_MS))
      }
      done = true
      window.clearTimeout(timer)
      setWaking(false)
    }
    void probe()
    return () => {
      done = true
      window.clearTimeout(timer)
    }
  }, [])

  if (!waking) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span>
        Starting the server — on free hosting the first load after a quiet spell takes a few seconds.
      </span>
    </div>
  )
}
