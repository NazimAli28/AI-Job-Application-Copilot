import type { ParsedResume } from '../schemas/resume'
import { extractSkills, normalizeSkill } from './skills'

export type SectionKey = 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'achievements'

const HEADINGS: Record<SectionKey, string[]> = {
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'about', 'about me', 'objective', 'career objective', 'career summary', 'executive summary'],
  experience: ['experience', 'work experience', 'professional experience', 'work history', 'employment history', 'employment', 'career history', 'relevant experience', 'experience and projects'],
  education: ['education', 'academic background', 'education & training', 'education and training', 'academics', 'academic qualifications'],
  skills: ['skills', 'technical skills', 'key skills', 'core competencies', 'skills & tools', 'skills and tools', 'technologies', 'tech stack', 'core skills', 'skills & technologies', 'technical proficiencies'],
  projects: ['projects', 'personal projects', 'selected projects', 'side projects', 'key projects', 'academic projects', 'open source', 'open source projects'],
  certifications: ['certifications', 'certificates', 'licenses & certifications', 'licenses and certifications', 'certifications & training', 'courses', 'training'],
  achievements: ['achievements', 'awards', 'honors', 'awards & honors', 'accomplishments', 'awards and achievements', 'honors & awards', 'key achievements'],
}

const HEADING_LOOKUP = new Map<string, SectionKey>()
for (const [k, list] of Object.entries(HEADINGS)) for (const h of list) HEADING_LOOKUP.set(h, k as SectionKey)

export const BULLET_RE = /^\s*(?:[•▪▫◦‣∙●○■□►▸*\-–—]|\d{1,2}[.)])\s+/
const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DATE_TOKEN = `(?:${MONTHS}\\.?,?\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4}-\\d{1,2}|\\d{4})`
const END_TOKEN = `(?:${DATE_TOKEN}|present|current|now|ongoing|today)`
export const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:–|—|-|to|until)\\s*(${END_TOKEN})`, 'i')

export function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim()
}
export const isBullet = (line: string) => BULLET_RE.test(line)

function headingKey(line: string): SectionKey | null {
  const t = line.trim()
  if (!t || t.length > 45 || isBullet(t)) return null
  const norm = t.replace(/[:\-–—_=#*|]+$/g, '').replace(/^[#*\-–—_=|\s]+/, '').trim().toLowerCase()
  return HEADING_LOOKUP.get(norm) ?? null
}

/** "Jan 2021" | "03/2020" | "2019-05" | "2019" -> "2021-01" | "2020-03" | "2019-05" | "2019". */
export function normalizeDateToken(tok: string): string | undefined {
  const t = tok.trim().toLowerCase().replace(/[.,]/g, '')
  if (/^(present|current|now|ongoing|today)$/.test(t)) return undefined
  let m = t.match(new RegExp(`^(${MONTHS})\\s+(\\d{4})$`, 'i'))
  if (m) {
    const idx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1]!.slice(0, 3))
    return `${m[2]}-${String(idx + 1).padStart(2, '0')}`
  }
  m = t.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[2]}-${m[1]!.padStart(2, '0')}`
  m = t.match(/^(\d{4})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}`
  m = t.match(/^(\d{4})$/)
  return m ? m[1] : undefined
}

const TITLE_RE = /\b(engineer|developer|manager|analyst|designer|intern|lead|director|consultant|architect|specialist|administrator|associate|officer|scientist|assistant|coordinator|head|vp|president|founder|programmer|technician|tester|qa|owner|writer|marketer|recruiter|representative|executive|strategist|researcher|teacher|tutor|freelance)\b/i

function splitHeader(s: string): string[] {
  return s
    .split(/\s+\|\s+|\s+[•·]\s+|\s+@\s+|\s+at\s+|\s+[–—-]\s+|\s*,\s+|\s{3,}/i)
    .map((p) => p.replace(/^[\s|•·]+|[\s|•·,(]+$/g, '').trim())
    .filter(Boolean)
}

function titleAndCompany(candidates: string[]): { title: string; company: string } {
  const parts = candidates.flatMap((c) => (c.length > 70 ? [c] : splitHeader(c))).filter(Boolean)
  const titleIdx = parts.findIndex((p) => TITLE_RE.test(p))
  if (titleIdx === -1) return { title: parts[0] ?? '', company: parts[1] ?? '' }
  const title = parts[titleIdx]!
  const rest = parts.filter((_, i) => i !== titleIdx)
  // company: first remaining part that is not a location-like fragment
  const company = rest.find((p) => !/^[A-Z]{2}$/.test(p) && !/^remote$/i.test(p)) ?? ''
  return { title, company }
}

function splitSections(lines: string[]): { header: string[]; sections: { key: SectionKey; lines: string[] }[] } {
  const header: string[] = []
  const sections: { key: SectionKey; lines: string[] }[] = []
  let cur: { key: SectionKey; lines: string[] } | null = null
  for (const line of lines) {
    const k = headingKey(line)
    if (k) {
      cur = { key: k, lines: [] }
      sections.push(cur)
    } else if (cur) cur.lines.push(line)
    else header.push(line)
  }
  return { header, sections }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
// optional +country, then digit groups separated by space/dash/dot/parens (validated by digit count below)
const PHONE_RE = /(?<![\w@/])(?:\+\s?)?(?:\(\d{1,4}\)|\d{1,4})(?:[\s.-]?(?:\(\d{1,4}\)|\d{1,4})){1,6}(?![\w@/])/
const URL_RE = /(?:https?:\/\/|www\.)[^\s|,;)<>]+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,;)<>]+|\b[a-z0-9][a-z0-9-]*\.(?:com|io|dev|me|app|co|net|org|xyz|tech)\/?[^\s|,;)<>@]*/gi

function isPhone(raw: string): boolean {
  const t = raw.trim()
  const digits = t.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return false
  if (DATE_RANGE_RE.test(t)) return false
  // only year-like groups ("2019 - 2021", "2019 2021") are dates, not phones
  if (/^(?:(?:19|20)\d{2}[\s.–—-]+)+(?:19|20)\d{2}$/.test(t)) return false
  return /^[+(]/.test(t) || /\d[\s.-]\d/.test(t)
}

function parseContact(header: string[], fullText: string): ParsedResume['contact'] {
  const headText = header.slice(0, 10).join('\n')
  const scope = headText || fullText.slice(0, 600)
  const email = (scope.match(EMAIL_RE) ?? fullText.match(EMAIL_RE))?.[0]
  let phone: string | undefined
  for (const m of scope.matchAll(new RegExp(PHONE_RE, 'g'))) {
    if (isPhone(m[0])) {
      phone = m[0].trim()
      break
    }
  }
  const links: string[] = []
  for (const m of (headText || fullText).matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;]+$/, '')
    if (email && email.toLowerCase().endsWith(u.toLowerCase())) continue
    if (!links.some((l) => l.toLowerCase() === u.toLowerCase())) links.push(u)
  }
  let name: string | undefined
  const first = header.map((l) => l.trim()).find(Boolean)
  if (first && first.split(/\s+/).length <= 5 && !/[@\d/:]/.test(first) && /^[\p{L}][\p{L} .'’-]+$/u.test(first)) name = first
  let location: string | undefined
  const segs = headText.split(/\n|\s+[|•·]\s+/).map((s) => s.trim()).filter(Boolean)
  for (const seg of segs) {
    if (EMAIL_RE.test(seg) || /https?:|www\.|linkedin|github/i.test(seg) || seg === name) continue
    const m = seg.match(/^(?:[A-Z][\p{L}.'-]+(?: [A-Z][\p{L}.'-]+)*),\s*(?:[A-Z]{2}|[A-Z][\p{L}.'-]+(?: [A-Z][\p{L}.'-]+)*)(?:,\s*[A-Z][\p{L}. ]+)?$/u)
    if (m) {
      location = m[0]
      break
    }
    if (/^remote$/i.test(seg)) location = 'Remote'
  }
  return { ...(name ? { name } : {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}), ...(location ? { location } : {}), links }
}

type Exp = ParsedResume['experience'][number]

function parseExperience(lines: string[]): Exp[] {
  const out: Exp[] = []
  let cur: Exp | null = null
  let pending: string[] = []
  let lastWasBullet = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const bullet = isBullet(line)
    const dm = bullet ? null : line.match(DATE_RANGE_RE)
    if (dm) {
      const remainder = line.replace(dm[0], '').replace(/[()|•·,–—-]+\s*$/g, '').replace(/^[()|•·,–—-]+\s*/g, '').trim()
      const cands = [...pending.slice(-2), ...(remainder ? [remainder] : [])]
      const { title, company } = titleAndCompany(cands)
      cur = { title, company, startDate: normalizeDateToken(dm[1]!), endDate: normalizeDateToken(dm[2]!), bullets: [] }
      out.push(cur)
      pending = []
      lastWasBullet = false
      continue
    }
    if (bullet) {
      if (!cur) continue
      cur.bullets.push(stripBullet(line))
      lastWasBullet = true
      continue
    }
    const words = line.split(/\s+/).length
    if (cur && lastWasBullet && /^[a-z(]/.test(line) && cur.bullets.length) {
      cur.bullets[cur.bullets.length - 1] += ` ${line}`
      continue
    }
    if (words <= 9 && !/[.!]$/.test(line)) {
      // possible header line for the next entry (or header continuation for an entry without a company yet)
      if (cur && !cur.bullets.length && (!cur.company || !cur.title)) {
        const { title, company } = titleAndCompany([cur.title, cur.company, line].filter(Boolean))
        cur.title = cur.title || title
        cur.company = cur.company || company
      } else {
        pending.push(line)
        lastWasBullet = false
      }
    } else if (cur) {
      cur.bullets.push(line)
      lastWasBullet = true
    }
  }
  // Entries without date lines at all: fall back to bullets-only grouping
  return out
}

const DEGREE_RE = /\b(bachelor(?:'s|s)?|master(?:'s|s)?|b\.?\s?sc?\.?|b\.?\s?a\.?|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?eng|m\.?\s?sc?\.?|m\.?\s?a\.?|m\.?\s?tech|m\.?\s?eng|mba|ph\.?\s?d|doctorate|associate(?:'s)?|diploma|high school|bsc|msc)\b/i
const INSTITUTION_RE = /\b(university|college|institute|school|academy|polytechnic|universit[éa])\b/i

function parseEducation(lines: string[]): ParsedResume['education'] {
  const out: ParsedResume['education'] = []
  let cur: { institution: string; degree: string; endDate?: string } | null = null
  const flush = () => {
    if (cur && (cur.institution || cur.degree)) out.push(cur)
    cur = null
  }
  for (const raw of lines) {
    const line = stripBullet(raw.trim())
    if (!line) continue
    const years = [...line.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0])
    const clean = line.replace(DATE_RANGE_RE, '').replace(/\(?\b(19|20)\d{2}\b\)?/g, '').replace(/[|,–—-]+\s*$/g, '').trim()
    const parts = clean.split(/\s+\|\s+|\s+[–—-]\s+|,\s+(?=[A-Z])/).map((p) => p.trim()).filter(Boolean)
    const degPart = parts.find((p) => DEGREE_RE.test(p))
    const instPart = parts.find((p) => INSTITUTION_RE.test(p) && p !== degPart) ?? parts.find((p) => INSTITUTION_RE.test(p))
    if (!degPart && !instPart) continue
    const needNew = cur && ((degPart && cur.degree) || (instPart && cur.institution && !degPart))
    if (!cur || needNew) {
      flush()
      cur = { institution: '', degree: '' }
    }
    const c: { institution: string; degree: string; endDate?: string } = cur!
    if (degPart && !c.degree) c.degree = degPart
    if (instPart && !c.institution && instPart !== degPart) c.institution = instPart
    else if (instPart && !c.institution && instPart === degPart) c.institution = instPart
    if (years.length) c.endDate = years[years.length - 1]
    cur = c
  }
  flush()
  return out
}

function parseProjects(lines: string[]): ParsedResume['projects'] {
  const out: ParsedResume['projects'] = []
  let cur: { name: string; description: string } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (isBullet(line)) {
      if (cur) cur.description = `${cur.description} ${stripBullet(line)}`.trim()
      else out.push((cur = { name: stripBullet(line).split(/\s[–—|:-]\s/)[0]!.slice(0, 80), description: stripBullet(line) }))
      continue
    }
    const sep = line.split(/\s+[–—|]\s+|:\s+|\s-\s/)
    const nameWords = sep[0]!.trim().split(/\s+/).length
    if (sep.length > 1 && nameWords <= 8) {
      cur = { name: sep[0]!.trim(), description: sep.slice(1).join(' - ').trim() }
      out.push(cur)
    } else if (nameWords <= 8 && !/[.!]$/.test(line) && (!cur || cur.description)) {
      cur = { name: line, description: '' }
      out.push(cur)
    } else if (cur) cur.description = `${cur.description} ${line}`.trim()
  }
  return out
}

const METRIC_RE = /\d/

export function parseResumeText(text: string): ParsedResume {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const { header, sections } = splitSections(lines)
  const get = (k: SectionKey) => sections.filter((s) => s.key === k).flatMap((s) => s.lines)

  const contact = parseContact(header, text)
  const summaryLines = get('summary').map((l) => l.trim()).filter(Boolean)
  const summary = summaryLines.length ? summaryLines.map(stripBullet).join(' ') : undefined

  const experience = parseExperience(get('experience'))
  const education = parseEducation(get('education'))
  const projects = parseProjects(get('projects'))
  const certifications = get('certifications').map((l) => stripBullet(l.trim())).filter(Boolean)

  const skillsSection = get('skills').join('\n')
  const fromSection = extractSkills(skillsSection)
  // also accept comma-separated tokens that normalise to a known skill
  for (const tok of skillsSection.split(/[,;|•\n:]/)) {
    const n = normalizeSkill(tok)
    if (n && !fromSection.includes(n)) fromSection.push(n)
  }
  const all = extractSkills(text)
  const skills = [...new Set([...fromSection, ...all])]

  const achievements: string[] = []
  const addAch = (s: string) => {
    const t = s.trim()
    if (t && !achievements.includes(t)) achievements.push(t)
  }
  for (const l of get('achievements')) addAch(stripBullet(l.trim()))
  for (const e of experience) for (const b of e.bullets) if (METRIC_RE.test(b) || /[%$]/.test(b)) addAch(b)

  return {
    contact,
    ...(summary ? { summary } : {}),
    skills,
    technologies: all,
    experience,
    education,
    projects,
    certifications,
    achievements,
    sections: sections.map((s) => s.key),
  }
}
