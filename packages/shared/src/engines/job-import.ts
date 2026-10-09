import type { ParsedJob } from '../schemas/job'
import { EMPLOYMENT_TYPES } from '../schemas/job'
import { parseJobDescription } from './job-parser'

export type JobProvider =
  | { provider: 'greenhouse'; apiUrl: string }
  | { provider: 'lever'; apiUrl: string }
  | { provider: 'generic' }

type Employment = (typeof EMPLOYMENT_TYPES)[number]
type WorkType = NonNullable<ParsedJob['workType']>

const GENERIC: JobProvider = { provider: 'generic' }

/** Minimal http(s) URL splitter (no DOM/URL dependency in shared). */
function splitUrl(url: string | undefined): { host: string; parts: string[] } | null {
  const m = url?.trim().match(/^https?:\/\/([^/?#\s:@]+)(?::\d+)?((?:\/[^?#\s]*)?)/i)
  if (!m) return null
  return { host: m[1]!.toLowerCase(), parts: m[2]!.split('/').filter(Boolean) }
}

/** Recognizes job-board URLs that expose a public JSON API (CORS-enabled). Only http(s). */
export function detectJobProvider(url: string): JobProvider {
  const u = splitUrl(url)
  if (!u) return GENERIC
  const { host, parts } = u

  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
    // /{board}/jobs/{id}  (EU boards: job-boards.eu.greenhouse.io is not supported by the public API host)
    const i = parts.indexOf('jobs')
    const board = parts[0]
    const jobId = parts[i + 1]
    if (i === 1 && board && jobId && /^\d+$/.test(jobId)) {
      return {
        provider: 'greenhouse',
        apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${jobId}`,
      }
    }
    return GENERIC
  }

  const lever = host.match(/^jobs(\.eu)?\.lever\.co$/)
  if (lever) {
    const [company, id] = parts
    if (company && id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      const api = lever[1] ? 'api.eu.lever.co' : 'api.lever.co'
      return {
        provider: 'lever',
        apiUrl: `https://${api}/v0/postings/${encodeURIComponent(company)}/${id}`,
      }
    }
  }
  return GENERIC
}

// ---------------------------------------------------------------- html -> text

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  eacute: 'é',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m
      try {
        return String.fromCodePoint(code)
      } catch {
        return m
      }
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Strips tags/entities to readable plain text (keeps list items as "- " lines). */
export function htmlToText(html: string): string {
  const text = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|h[1-6]|ul|ol|section|article|header|footer|tr|table|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/^- *$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Text that may be HTML or HTML-escaped HTML (Greenhouse). */
const anyHtmlToText = (s: string) => htmlToText(/&lt;\s*\/?[a-z]/i.test(s) && !/<[a-z]/i.test(s) ? decodeEntities(s) : s)

// ---------------------------------------------------------------- helpers

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

const titleCase = (slug: string) =>
  slug
    .replace(/[-_.]+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())

function mapEmployment(v: unknown): Employment | undefined {
  const s = (Array.isArray(v) ? str(v[0]) : str(v))?.toLowerCase().replace(/[_-]+/g, ' ')
  if (!s) return undefined
  if (/part/.test(s)) return 'part-time'
  if (/intern/.test(s)) return 'internship'
  if (/contract|freelance/.test(s)) return 'contract'
  if (/temp/.test(s)) return 'temporary'
  if (/full|permanent|regular/.test(s)) return 'full-time'
  return undefined
}

function mapWorkType(v: unknown): WorkType | undefined {
  const s = str(v)?.toLowerCase()
  if (!s) return undefined
  if (s.includes('remote')) return 'remote'
  if (s.includes('hybrid')) return 'hybrid'
  if (/on[- ]?site|office/.test(s)) return 'onsite'
  return undefined
}

/** Runs the rules parser over the description, then lets explicit API fields win. */
function merge(description: string, explicit: Partial<ParsedJob>): ParsedJob {
  const parsed = parseJobDescription(description)
  const out: ParsedJob = { ...parsed, description }
  for (const [k, v] of Object.entries(explicit)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

const slugFromUrl = (url: string | undefined, host: RegExp): string | undefined => {
  const u = splitUrl(url)
  return u && host.test(u.host) ? u.parts[0] : undefined
}

// ---------------------------------------------------------------- providers

/** Greenhouse boards-api job JSON -> ParsedJob. */
export function jobFromGreenhouse(json: unknown): ParsedJob {
  if (!isObj(json)) return { responsibilities: [], requirements: [] }
  const description = anyHtmlToText(str(json.content) ?? '')
  const url = str(json.absolute_url)
  const slug = slugFromUrl(url, /greenhouse\.io$/i)
  const location = isObj(json.location) ? str(json.location.name) : str(json.location)
  const company = str(json.company_name) ?? (slug ? titleCase(slug) : undefined)
  return merge(description, {
    title: str(json.title),
    company,
    location,
    url,
  })
}

/** Lever postings API JSON -> ParsedJob. */
export function jobFromLever(json: unknown): ParsedJob {
  if (!isObj(json)) return { responsibilities: [], requirements: [] }
  const cats = isObj(json.categories) ? json.categories : {}
  const blocks: string[] = []
  const intro = str(json.descriptionPlain) ?? (str(json.description) ? htmlToText(str(json.description)!) : '')
  if (intro) blocks.push(intro)
  if (Array.isArray(json.lists)) {
    for (const l of json.lists) {
      if (!isObj(l)) continue
      const heading = str(l.text)
      const body = str(l.content) ? htmlToText(str(l.content)!) : ''
      if (heading) blocks.push(heading.replace(/:?$/, ':'))
      if (body) blocks.push(body.split('\n').map((x) => (x.startsWith('- ') ? x : `- ${x}`)).join('\n'))
    }
  }
  const extra = str(json.additionalPlain) ?? (str(json.additional) ? htmlToText(str(json.additional)!) : '')
  if (extra) blocks.push(extra)
  const url = str(json.hostedUrl)
  const slug = slugFromUrl(url, /lever\.co$/i)
  return merge(blocks.join('\n\n'), {
    title: str(json.text),
    company: slug ? titleCase(slug) : undefined,
    location: str(cats.location),
    employmentType: mapEmployment(cats.commitment),
    workType: mapWorkType(json.workplaceType),
    url,
  })
}

// ---------------------------------------------------------------- generic HTML

function formatSalary(v: unknown): string | undefined {
  if (!isObj(v)) return undefined
  const cur = str(v.currency)
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : cur ? `${cur} ` : ''
  const fmt = (n: unknown) => (typeof n === 'number' || (typeof n === 'string' && n.trim() && !isNaN(Number(n))) ? `${sym}${Number(n).toLocaleString('en-US')}` : undefined)
  const val = isObj(v.value) ? v.value : v
  const unit = str(val.unitText)?.toLowerCase()
  const min = fmt(val.minValue)
  const max = fmt(val.maxValue)
  const single = fmt(val.value)
  const amount = min && max ? `${min} – ${max}` : (single ?? min ?? max)
  if (!amount) return undefined
  return `${amount}${unit ? ` / ${unit}` : ''}`.slice(0, 80)
}

function jsonLdLocation(loc: unknown): string | undefined {
  const first = Array.isArray(loc) ? loc[0] : loc
  if (typeof first === 'string') return str(first)
  if (!isObj(first)) return undefined
  const a = first.address
  if (typeof a === 'string') return str(a)
  if (!isObj(a)) return str(first.name)
  const country = isObj(a.addressCountry) ? str(a.addressCountry.name) : str(a.addressCountry)
  return [str(a.addressLocality), str(a.addressRegion), country].filter(Boolean).join(', ') || undefined
}

function collectJobPostings(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) return node.forEach((n) => collectJobPostings(n, out))
  if (!isObj(node)) return
  const t = node['@type']
  if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) out.push(node)
  if (node['@graph']) collectJobPostings(node['@graph'], out)
}

function metaContent(html: string, key: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const k = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]
    if (k?.toLowerCase() !== key) continue
    const c = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    const v = c?.[1] ?? c?.[2]
    if (v) return decodeEntities(v).trim() || undefined
  }
  return undefined
}

/** Any HTML page: schema.org JobPosting JSON-LD first, then meta/og tags + main text. null if nothing usable. */
export function extractJobFromHtml(
  html: string,
  url?: string,
): (ParsedJob & { provider: 'jsonld' | 'html' }) | null {
  if (typeof html !== 'string' || !html.trim()) return null

  // ---- JSON-LD
  const postings: Record<string, unknown>[] = []
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi
  for (const m of html.matchAll(re)) {
    try {
      collectJobPostings(JSON.parse(m[1]!.trim()), postings)
    } catch {
      /* ignore malformed block */
    }
  }
  const jp = postings[0]
  if (jp) {
    const raw = str(jp.description) ?? ''
    const description = anyHtmlToText(raw)
    const org = jp.hiringOrganization
    const company = typeof org === 'string' ? str(org) : isObj(org) ? str(org.name) : undefined
    const remote = str(jp.jobLocationType)?.toUpperCase() === 'TELECOMMUTE'
    const title = str(jp.title) ? decodeEntities(str(jp.title)!) : undefined
    const merged = merge(description, {
      title,
      company: company ? decodeEntities(company) : undefined,
      location: jsonLdLocation(jp.jobLocation),
      employmentType: mapEmployment(jp.employmentType),
      workType: remote ? 'remote' : undefined,
      salary: formatSalary(jp.baseSalary),
      url,
    })
    return { ...merged, provider: 'jsonld' }
  }

  // ---- fallback: meta tags + main text
  const body =
    html.match(/<main\b[\s\S]*?<\/main\s*>/i)?.[0] ??
    html.match(/<article\b[\s\S]*?<\/article\s*>/i)?.[0] ??
    html.match(/<body\b[\s\S]*?<\/body\s*>/i)?.[0] ??
    html
  const text = htmlToText(body)
  if (text.length < 300) return null
  const pageTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]
  const title = metaContent(html, 'og:title') ?? (pageTitle ? decodeEntities(pageTitle).replace(/\s+/g, ' ').trim() : undefined)
  const merged = merge(text, {
    title,
    company: metaContent(html, 'og:site_name'),
    url,
  })
  return { ...merged, provider: 'html' }
}

/** Fills requirements/responsibilities from the description when the provider gave none. */
export function enrichParsedJob(job: ParsedJob): ParsedJob {
  if (job.requirements.length > 0 || !job.description) return job
  const p = parseJobDescription(job.description)
  return {
    ...job,
    requirements: p.requirements,
    responsibilities: job.responsibilities.length ? job.responsibilities : p.responsibilities,
    experienceYearsMin: job.experienceYearsMin ?? p.experienceYearsMin,
    educationRequirement: job.educationRequirement ?? p.educationRequirement,
  }
}
