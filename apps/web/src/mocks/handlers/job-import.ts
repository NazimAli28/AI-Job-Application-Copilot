import {
  detectJobProvider,
  enrichParsedJob as enrich,
  extractJobFromHtml,
  jobFromGreenhouse,
  jobFromLever,
  type ImportUrlResult,
} from '@copilot/shared'

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, credentials: 'omit' })
  } finally {
    clearTimeout(t)
  }
}

/** Real network import (browser-side, prototype). Returns null on any failure — never throws. */
export async function importFromUrl(url: string): Promise<ImportUrlResult | null> {
  try {
    const p = detectJobProvider(url)
    if (p.provider === 'greenhouse' || p.provider === 'lever') {
      const res = await fetchWithTimeout(p.apiUrl)
      if (!res.ok) return null
      const json: unknown = await res.json()
      const job = p.provider === 'greenhouse' ? jobFromGreenhouse(json) : jobFromLever(json)
      if (!job.title && !job.description) return null
      return { provider: p.provider, job: enrich({ ...job, url: job.url || url }) }
    }
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const html = await res.text()
    const found = extractJobFromHtml(html, url)
    if (!found) return null
    const { provider, ...job } = found
    return { provider, job: enrich({ ...job, url: job.url || url }) }
  } catch {
    return null
  }
}
