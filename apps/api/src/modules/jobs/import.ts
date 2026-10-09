import {
  detectJobProvider,
  enrichParsedJob,
  extractJobFromHtml,
  jobFromGreenhouse,
  jobFromLever,
  type ImportUrlResult,
  type ParsedJob,
} from '@copilot/shared'
import type { Logger } from '../../lib/logger'
import type { HttpFetch } from '../../lib/safe-fetch'

/** Provider data is untrusted: keep only http(s) links (the UI renders job.url as a link). */
const safeUrl = (job: ParsedJob, fallback: string): ParsedJob => ({
  ...job,
  url: job.url && /^https?:\/\//i.test(job.url) ? job.url : fallback,
})

/**
 * Server-side job import (D10): Greenhouse/Lever public JSON APIs, otherwise the page's
 * schema.org JobPosting JSON-LD or meta/text. All requests go through the SSRF-guarded fetcher.
 * Returns null on any failure — the UI then saves the link and asks for the description.
 */
export async function importJob(
  url: string,
  fetch: HttpFetch,
  log: Logger,
): Promise<ImportUrlResult | null> {
  try {
    const p = detectJobProvider(url)
    if (p.provider === 'greenhouse' || p.provider === 'lever') {
      const res = await fetch(p.apiUrl, { accept: 'application/json' })
      if (res.status < 200 || res.status >= 300) return null
      const json: unknown = JSON.parse(res.body)
      const job = p.provider === 'greenhouse' ? jobFromGreenhouse(json) : jobFromLever(json)
      if (!job.title && !job.description) return null
      return { provider: p.provider, job: enrichParsedJob(safeUrl(job, url)) }
    }
    const res = await fetch(url, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' })
    if (res.status < 200 || res.status >= 300) return null
    if (res.contentType && !/html|xml/.test(res.contentType)) return null
    const found = extractJobFromHtml(res.body, res.url)
    if (!found) return null
    const { provider, ...job } = found
    return { provider, job: enrichParsedJob(safeUrl(job, url)) }
  } catch (err) {
    log.debug({ err: (err as Error).message }, 'job import failed')
    return null
  }
}
