/**
 * Real API vs offline prototype (D14 → retired in Phase 9). Every module, the demo account
 * included, is served by apps/api; MSW only runs in dev when no API answers `/api/health`
 * (or with `VITE_REAL_API=off`), keeping the prototype clickable without a backend.
 */
export async function detectRealApi(): Promise<boolean> {
  if (import.meta.env.VITE_REAL_API === 'off') return false
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2500) })
    return res.ok
  } catch {
    return false
  }
}
