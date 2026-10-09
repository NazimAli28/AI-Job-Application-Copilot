import type { JobRequirement, ParsedJob } from '../schemas/job'
import { EMPLOYMENT_TYPES } from '../schemas/job'
import { extractSkills } from './skills'
import { stripBullet } from './resume-parser'

type JobSection = 'resp' | 'req' | 'pref' | 'other' | 'intro'

function sectionOf(line: string): JobSection | null {
  const t = line.trim()
  if (!t || t.length > 70 || /^\s*[•\-*▪–]\s/.test(t)) return null
  const words = t.split(/\s+/).length
  if (words > 7) return null
  const n = t.replace(/[:\-–—*#]+$/g, '').replace(/^[#*\-–—\s]+/, '').toLowerCase()
  if (/(nice[- ]to[- ]haves?|good to have|bonus|preferred|desirable|extra credit|a plus|pluses|plus points)/.test(n)) return 'pref'
  if (/(benefits|perks|what we offer|compensation|why join|equal opportunity|how to apply|our culture|about us|about the company|who we are|our values)/.test(n)) return 'other'
  if (/^about\s/.test(n) && !/about you/.test(n)) return 'other'
  if (/(responsibilit|what you.ll do|what you will do|what you.ll be doing|your role|the role|key duties|duties|day[- ]to[- ]day|you will)/.test(n)) return 'resp'
  if (/(requirement|qualification|what we.re looking for|who you are|must[- ]have|you have|what you bring|about you|skills|your experience|minimum|basic qualifications)/.test(n)) return 'req'
  return null
}

const YEARS_RE = /(?:minimum of |at least |min\.? )?(\d{1,2})\s*(?:\+|\s*(?:-|–|to)\s*\d{1,2}\s*)?\s*\+?\s*years?/i
const DEGREE_LINE_RE = /\b(bachelor|master|ph\.?d|doctorate|associate degree|b\.?s\.?c?\b|m\.?s\.?c?\b|degree)/i
const SALARY_RE = /(?:[$€£]|USD\s?|EUR\s?|GBP\s?)\s?\d[\d,.]*\s?[kK]?(?:\s?(?:-|–|—|to)\s?(?:[$€£]|USD\s?|EUR\s?|GBP\s?)?\s?\d[\d,.]*\s?[kK]?)?(?:\s*(?:\/|per\s)\s*(?:yr|year|hour|hr|month|annum|mo)\b)?/
const INLINE_PREF_RE = /\b(nice to have|nice-to-have|preferred|a plus|bonus|desirable|ideally)\b/i

function labelValue(lines: string[], labels: string[]): string | undefined {
  const re = new RegExp(`^\\s*(?:${labels.join('|')})\\s*[:\\-–]\\s*(.+)$`, 'i')
  for (const l of lines) {
    const m = l.match(re)
    if (m) return m[1]!.trim()
  }
  return undefined
}

const LOCATION_HINT_RE = /b(remote|hybrid|on[- ]?site|[A-Z][a-z]+,\s*[A-Z])|\(|b(EU|US|USA|UK|EMEA|APAC|Europe|Worldwide)b/

/** "Company - Location" style line right after the title (separators: - – — · | •). */
function headerLine(lines: string[]): { company: string; location: string } | undefined {
  const nonEmpty = lines.filter((l) => l.trim()).slice(0, 4)
  for (const l of nonEmpty.slice(1)) {
    const m = l.trim().match(/^([A-Z][\w&.'’]*(?: [A-Za-z&][\w&.'’]*){0,4})\s+(?:-|–|—|·|\||•)\s+(.{2,60})$/)
    if (m && LOCATION_HINT_RE.test(m[2]!) && !/^(?:about|location|company)b/i.test(m[1]!)) return { company: m[1]!.trim(), location: m[2]!.trim() }
  }
  return undefined
}

function guessCompany(lines: string[]): string | undefined {
  const labelled = labelValue(lines, ['company', 'employer', 'organization', 'organisation'])
  if (labelled) return labelled
  for (const l of lines.slice(0, 40)) {
    const m = l.trim().match(/^about\s+(?!the\b|us\b|you\b|this\b|our\b|your\b|me\b)([A-Z][\w&.'’ -]{1,50})$/i)
    if (m) return m[1]!.trim()
  }
  const hl = headerLine(lines)
  if (hl) return hl.company
  const head = lines.slice(0, 6).join(' \n ')
  let m = head.match(/^([A-Z][\w&.'’-]*(?: [A-Z&][\w&.'’-]*){0,3}) (?:is|are) (?:hiring|looking|seeking|searching|growing)/m)
  if (m) return m[1]!
  m = head.match(/\b(?:at|@|join)\s+([A-Z][\w&.'’-]*(?: [A-Z&][\w&.'’-]*){0,3})(?=[,.\n(!]| is | -| –|$)/)
  return m?.[1]
}

function guessTitle(lines: string[]): string | undefined {
  const labelled = labelValue(lines, ['job title', 'title', 'position', 'role'])
  if (labelled) return labelled
  const first = lines.find((l) => l.trim())?.trim()
  if (!first) return undefined
  if (first.split(/\s+/).length > 12 || /^about\b/i.test(first)) return undefined
  const sep = first.match(/^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+)$/)
  return (sep ? sep[1]! : first).replace(/[:.]+$/, '').trim()
}

function guessLocation(lines: string[]): string | undefined {
  const labelled = labelValue(lines, ['location', 'based in', 'office'])
  if (labelled) return labelled
  const hl = headerLine(lines)
  if (hl) return hl.location
  for (const l of lines.slice(0, 8)) {
    const m = l.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)*, (?:[A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)*))\b/)
    if (m) return m[1]
  }
  const head = lines.slice(0, 8).join('\n')
  if (/\bfully remote\b|\bremote\b/i.test(head)) return 'Remote'
  return undefined
}

function guessEmploymentType(text: string): (typeof EMPLOYMENT_TYPES)[number] | undefined {
  const t = text.toLowerCase()
  if (/\bfull[- ]time\b/.test(t)) return 'full-time'
  if (/\bpart[- ]time\b/.test(t)) return 'part-time'
  if (/\binternship\b|\bintern\b/.test(t)) return 'internship'
  if (/\bcontract(?:or)?\b|\bfreelance\b/.test(t)) return 'contract'
  if (/\btemporary\b|\btemp\b/.test(t)) return 'temporary'
  return undefined
}

function guessWorkType(text: string, head: string): 'remote' | 'hybrid' | 'onsite' | undefined {
  const t = text.toLowerCase()
  if (/\bhybrid\b/.test(t)) return 'hybrid'
  if (/\b(?:fully |100% )?remote\b/.test(head.toLowerCase()) || /\bfully remote\b|\bwork from home\b|\bremote[- ]first\b/.test(t)) return 'remote'
  if (/\bon[- ]?site\b|\bin[- ]office\b|\bin[- ]person\b/.test(t)) return 'onsite'
  if (/\bremote\b/.test(t)) return 'remote'
  return undefined
}

export function parseJobDescription(description: string): ParsedJob {
  const lines = description.replace(/\r\n?/g, '\n').split('\n')
  const nonEmpty = lines.filter((l) => l.trim())

  // ---- sections
  let cur: JobSection = 'intro'
  let sawSection = false
  const tagged: { line: string; section: JobSection }[] = []
  for (const l of lines) {
    if (!l.trim()) continue
    const s = sectionOf(l)
    if (s) {
      cur = s
      sawSection = true
      continue
    }
    tagged.push({ line: l, section: cur })
  }

  const responsibilities = tagged
    .filter((t) => t.section === 'resp')
    .map((t) => stripBullet(t.line))
    .filter((t) => t.length > 3)
    .slice(0, 20)

  // ---- skills and other requirements
  const requirements: JobRequirement[] = []
  const seenSkills = new Set<string>()
  let n = 0
  const nextId = () => `req-${++n}`
  const addSkills = (kind: 'required' | 'preferred', text: string) => {
    for (const skill of extractSkills(text)) {
      if (seenSkills.has(skill)) continue
      seenSkills.add(skill)
      requirements.push({ id: nextId(), kind, category: 'skill', text: skill, skill })
    }
  }
  // split lines into clauses so "X and ideally Y is a plus" only marks Y as preferred
  const clauses = (line: string) => line.split(/(?<=[.;!?])\s+|\s+(?:and|but|,)\s+(?=(?:ideally|preferably|bonus))|,\s*(?=(?:ideally|preferably))/i).filter(Boolean)
  const units = tagged.flatMap((t) => clauses(t.line).map((c) => ({ line: c, section: t.section })))
  const reqUnits = units.filter((t) => (sawSection ? t.section !== 'pref' && t.section !== 'other' : true))
  const prefUnits = units.filter((t) => t.section === 'pref')
  const isInlinePref = (t: { line: string }) => INLINE_PREF_RE.test(t.line)
  // required first, then preferred, so a skill present in both is required
  for (const t of reqUnits.filter((x) => !isInlinePref(x))) addSkills('required', t.line)
  for (const t of prefUnits) addSkills('preferred', t.line)
  for (const t of reqUnits.filter(isInlinePref)) addSkills('preferred', t.line)

  // experience / education / other lines
  let experienceYearsMin: number | undefined
  let educationRequirement: string | undefined
  const reqSectionLines = tagged.filter((t) => (sawSection ? t.section === 'req' || t.section === 'pref' : true))
  for (const t of reqSectionLines) {
    const text = stripBullet(t.line)
    if (text.length < 4) continue
    const kind = t.section === 'pref' || INLINE_PREF_RE.test(text) ? 'preferred' : 'required'
    const ym = text.match(YEARS_RE)
    if (ym && /experience|exp\b/i.test(text)) {
      if (experienceYearsMin === undefined && kind === 'required') experienceYearsMin = Number(ym[1])
      requirements.push({ id: nextId(), kind, category: 'experience', text })
    } else if (DEGREE_LINE_RE.test(text)) {
      if (!educationRequirement) educationRequirement = text.slice(0, 200)
      requirements.push({ id: nextId(), kind, category: 'education', text })
    } else if (t.section === 'req' && text.split(/\s+/).length >= 4 && extractSkills(text).length === 0) {
      requirements.push({ id: nextId(), kind, category: 'other', text })
    }
  }
  if (experienceYearsMin === undefined) {
    for (const l of nonEmpty) {
      const m = l.match(YEARS_RE)
      if (m && /experience/i.test(l)) {
        experienceYearsMin = Number(m[1])
        break
      }
    }
  }

  // ---- header facts
  const head = nonEmpty.slice(0, 8).join('\n')
  const title = guessTitle(lines)
  const company = guessCompany(lines)
  const location = guessLocation(lines)
  const employmentType = guessEmploymentType(description)
  const workType = guessWorkType(description, head)
  const salary = description.match(SALARY_RE)?.[0].trim()

  return {
    ...(title ? { title } : {}),
    ...(company ? { company } : {}),
    ...(location ? { location } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(workType ? { workType } : {}),
    ...(salary && /\d{2}/.test(salary) ? { salary } : {}),
    description,
    ...(experienceYearsMin !== undefined ? { experienceYearsMin } : {}),
    ...(educationRequirement ? { educationRequirement } : {}),
    responsibilities,
    requirements,
  }
}
