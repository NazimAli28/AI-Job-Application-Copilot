/** Strong action verbs grouped by meaning (used for suggestions; the user picks what is true). */
export const STRONG_VERBS: Record<string, string[]> = {
  build: ['Built', 'Developed', 'Designed', 'Implemented', 'Engineered', 'Created', 'Architected', 'Launched'],
  lead: ['Led', 'Managed', 'Coordinated', 'Directed', 'Mentored', 'Supervised', 'Organized'],
  improve: ['Improved', 'Optimized', 'Streamlined', 'Reduced', 'Increased', 'Enhanced', 'Accelerated', 'Refactored'],
  analyze: ['Analyzed', 'Evaluated', 'Investigated', 'Identified', 'Researched', 'Audited', 'Diagnosed'],
  collaborate: ['Collaborated', 'Partnered', 'Contributed', 'Supported', 'Facilitated', 'Delivered'],
  maintain: ['Maintained', 'Migrated', 'Automated', 'Deployed', 'Resolved', 'Tested', 'Documented'],
}

export const ALL_STRONG_VERBS: string[] = [...new Set(Object.values(STRONG_VERBS).flat())]

/** Gerund -> past-tense form (only unambiguous conversions). */
const GERUND_TO_PAST: Record<string, string> = {
  managing: 'Managed', developing: 'Developed', building: 'Built', designing: 'Designed',
  implementing: 'Implemented', maintaining: 'Maintained', testing: 'Tested', writing: 'Wrote',
  creating: 'Created', leading: 'Led', coordinating: 'Coordinated', analyzing: 'Analyzed',
  analysing: 'Analyzed', optimizing: 'Optimized', deploying: 'Deployed', monitoring: 'Monitored',
  maintaing: 'Maintained', reviewing: 'Reviewed', training: 'Trained', mentoring: 'Mentored',
  supporting: 'Supported', configuring: 'Configured', integrating: 'Integrated', migrating: 'Migrated',
  automating: 'Automated', documenting: 'Documented', resolving: 'Resolved', delivering: 'Delivered',
  planning: 'Planned', organizing: 'Organized', preparing: 'Prepared', handling: 'Handled',
  processing: 'Processed', producing: 'Produced', updating: 'Updated', improving: 'Improved',
  debugging: 'Debugged', administering: 'Administered', overseeing: 'Oversaw', conducting: 'Conducted',
  collaborating: 'Collaborated', communicating: 'Communicated', researching: 'Researched',
  fixing: 'Fixed', launching: 'Launched', running: 'Ran', executing: 'Executed', driving: 'Drove',
}

/** Gerund forms for base verbs ("helped build" -> "Contributed to building"). */
const BASE_TO_GERUND: Record<string, string> = {
  build: 'building', develop: 'developing', design: 'designing', implement: 'implementing',
  maintain: 'maintaining', test: 'testing', write: 'writing', create: 'creating', lead: 'leading',
  manage: 'managing', improve: 'improving', optimize: 'optimizing', deploy: 'deploying',
  fix: 'fixing', launch: 'launching', run: 'running', migrate: 'migrating', automate: 'automating',
  organize: 'organizing', coordinate: 'coordinating', deliver: 'delivering', resolve: 'resolving',
  support: 'supporting', review: 'reviewing', document: 'documenting', plan: 'planning',
}

type OpenerRule = { re: RegExp; kind: 'gerund-past' | 'to' | 'contributed' | 'supported'; fallback: string }

const OPENER_RULES: OpenerRule[] = [
  { re: /^(?:was|were)?\s*responsible for\s+/i, kind: 'gerund-past', fallback: 'Handled' },
  { re: /^(?:was|were)?\s*in charge of\s+/i, kind: 'gerund-past', fallback: 'Handled' },
  { re: /^duties (?:included|include|included:)\s+/i, kind: 'gerund-past', fallback: 'Handled' },
  { re: /^(?:was|were)?\s*tasked with\s+/i, kind: 'gerund-past', fallback: 'Handled' },
  { re: /^(?:was|were)?\s*charged with\s+/i, kind: 'gerund-past', fallback: 'Handled' },
  { re: /^worked on\s+/i, kind: 'contributed', fallback: 'Contributed to' },
  { re: /^worked with\s+/i, kind: 'contributed', fallback: 'Collaborated with' },
  { re: /^helped (?:to\s+)?/i, kind: 'to', fallback: 'Contributed to' },
  { re: /^assisted (?:with|in|on)\s+/i, kind: 'supported', fallback: 'Supported' },
  { re: /^assisted\s+/i, kind: 'supported', fallback: 'Supported' },
  { re: /^(?:participated|involved) in\s+/i, kind: 'contributed', fallback: 'Contributed to' },
  { re: /^(?:was|were) involved in\s+/i, kind: 'contributed', fallback: 'Contributed to' },
  { re: /^utili[sz]ed\s+/i, kind: 'contributed', fallback: 'Used' },
]

/** "X and maintaining Y" -> "X and maintained Y" when the second gerund is known (parallel structure). */
function pastAfterAnd(rest: string): string {
  return rest.replace(/^((?:\S+\s+){0,5}?)and (\w+ing)\b/i, (m, pre: string, g: string) => {
    const past = GERUND_TO_PAST[g.toLowerCase()]
    return past ? `${pre}and ${past.toLowerCase()}` : m
  })
}

export function weakOpenerOf(bullet: string): string | null {
  const t = bullet.trim()
  for (const r of OPENER_RULES) {
    const m = t.match(r.re)
    if (m) return m[0].trim()
  }
  return null
}

/**
 * Replaces ONLY the weak opener of a bullet with a stronger verb. Every other word is kept verbatim,
 * so no facts or numbers are added. Returns null when the bullet has no weak opener.
 */
export function rewriteWeakOpener(bullet: string): string | null {
  const t = bullet.trim()
  for (const rule of OPENER_RULES) {
    const m = t.match(rule.re)
    if (!m) continue
    const rest = t.slice(m[0].length)
    const firstWord = rest.split(/\s+/)[0]?.toLowerCase() ?? ''
    if (!rest) return null
    if (rule.kind === 'gerund-past') {
      const past = GERUND_TO_PAST[firstWord]
      if (past) return `${past} ${pastAfterAnd(rest.slice(firstWord.length).trimStart())}`.trim()
      return `${rule.fallback} ${rest}`
    }
    if (rule.kind === 'to') {
      const g = BASE_TO_GERUND[firstWord]
      if (g) return `Contributed to ${g} ${rest.slice(firstWord.length).trimStart()}`.trim()
      return `${rule.fallback} ${rest}`
    }
    return `${rule.fallback} ${rest}`
  }
  return null
}
