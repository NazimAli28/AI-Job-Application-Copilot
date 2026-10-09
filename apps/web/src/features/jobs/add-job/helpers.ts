import type { JobInput } from '@copilot/shared'

/** Best-effort company name from a posting URL (boards put it in the path, others in the domain). */
export function companyFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const parts = host.split('.')
    const board = /greenhouse|lever|ashbyhq|workable|smartrecruiters/.test(host)
    const raw = board ? u.pathname.split('/').filter(Boolean)[0] : parts[Math.max(0, parts.length - 2)]
    if (!raw || /^(linkedin|indeed|glassdoor)$/.test(raw)) return ''
    return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return ''
  }
}

export const parseTags = (s: string): string[] =>
  [...new Set(s.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 10)

export const withStatus = (v: JobInput, applied: boolean): JobInput => ({
  ...v,
  status: applied ? 'applied' : 'saved',
})

export const PROVIDER_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  jsonld: 'the page structured data',
  html: 'the page',
}
