import { NO_AUTO_ALIAS, SKILL_LINES } from './data/skills-data'

export type SkillDef = { aliases: string[]; category: string; related?: string[] }

/** Canonical skill name -> lowercase aliases, category and related skills. */
export const SKILLS: Record<string, SkillDef> = {}

type Term = { canonical: string; term: string }
const ciTerms: Term[] = []
const csTerms: Term[] = []
const ctxTerms: Term[] = []

for (const line of SKILL_LINES) {
  const [name, category, aliasStr = '', relStr = ''] = line.split('|') as [string, string, string?, string?]
  const aliases: string[] = []
  for (const raw of aliasStr.split(',').map((a) => a.trim()).filter(Boolean)) {
    if (raw.startsWith('=')) {
      csTerms.push({ canonical: name, term: raw.slice(1) })
      aliases.push(raw.slice(1).toLowerCase())
    } else if (raw.startsWith('?')) {
      ctxTerms.push({ canonical: name, term: raw.slice(1) })
      aliases.push(raw.slice(1).toLowerCase())
    } else {
      ciTerms.push({ canonical: name, term: raw.toLowerCase() })
      aliases.push(raw.toLowerCase())
    }
  }
  if (!NO_AUTO_ALIAS.has(name)) ciTerms.push({ canonical: name, term: name.toLowerCase() })
  if (!aliases.includes(name.toLowerCase())) aliases.push(name.toLowerCase())
  const related = relStr.split(',').map((r) => r.trim()).filter(Boolean)
  SKILLS[name] = { aliases, category, ...(related.length ? { related } : {}) }
}

// ---- lookup maps
const aliasMap = new Map<string, string>()
const compactMap = new Map<string, string>()
const compact = (s: string) => s.toLowerCase().replace(/[\s._-]+/g, '')
for (const [name, def] of Object.entries(SKILLS)) {
  for (const a of [name.toLowerCase(), ...def.aliases]) {
    if (!aliasMap.has(a)) aliasMap.set(a, name)
    const c = compact(a)
    if (c && !compactMap.has(c)) compactMap.set(c, name)
  }
}

const reverseRelated = new Map<string, Set<string>>()
for (const [name, def] of Object.entries(SKILLS)) {
  for (const r of def.related ?? []) {
    if (!reverseRelated.has(r)) reverseRelated.set(r, new Set())
    reverseRelated.get(r)!.add(name)
  }
}

/** Returns the canonical skill name for any alias/case/punctuation variant, or null. */
export function normalizeSkill(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^[\s,;:()[\]"'•\-*]+|[\s,;:()[\]"']+$/g, '')
  if (!s) return null
  return aliasMap.get(s) ?? aliasMap.get(s.replace(/\.$/, '')) ?? compactMap.get(compact(s)) ?? null
}

/** Skills that are close substitutes / adjacent to the given one (both directions). */
export function relatedSkills(name: string): string[] {
  const canon = normalizeSkill(name) ?? name
  const out = new Set<string>(SKILLS[canon]?.related ?? [])
  for (const r of reverseRelated.get(canon) ?? []) out.add(r)
  out.delete(canon)
  return [...out].filter((r) => r in SKILLS)
}

export function skillCategory(name: string): string | null {
  const canon = normalizeSkill(name)
  return canon ? (SKILLS[canon]?.category ?? null) : null
}

// ---- matcher (compiled once)
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const ciMap = new Map(ciTerms.map((t) => [t.term, t.canonical]))
const csMap = new Map(csTerms.map((t) => [t.term, t.canonical]))
const ctxMap = new Map(ctxTerms.map((t) => [t.term, t.canonical]))
const byLen = (a: string, b: string) => b.length - a.length

const ciRe = new RegExp(
  `(?<![A-Za-z0-9_])(?:${[...ciMap.keys()].sort(byLen).map(esc).join('|')})(?![A-Za-z0-9_])`,
  'gi',
)
const csRe = new RegExp(
  `(?<![A-Za-z0-9_])(?:${[...csMap.keys()].sort(byLen).map(esc).join('|')})(?![A-Za-z0-9_])`,
  'g',
)
/** Single-letter / ambiguous words ("Go", "R", "C") only match inside lists or after "in/with/using". */
const ctxRe = new RegExp(
  `(?<=^|[,;/|(\\u2022\\u00b7:]\\s*|\\b(?:and|or|in|with|using)\\s)(${[...ctxMap.keys()].sort(byLen).map(esc).join('|')})(?=\\s*[,;/|)\\u2022\\u00b7.]|\\s*$|\\s+(?:and|or)\\s|\\s+(?:developer|programming|language|backend|services|microservices)\\b)`,
  'gm',
)

/** Finds canonical skills mentioned anywhere in free text, in order of first appearance. */
export function extractSkills(text: string): string[] {
  if (!text) return []
  const hits: { index: number; skill: string }[] = []
  for (const m of text.matchAll(ciRe)) {
    const s = ciMap.get(m[0].toLowerCase())
    if (s) hits.push({ index: m.index ?? 0, skill: s })
  }
  for (const m of text.matchAll(csRe)) {
    const s = csMap.get(m[0])
    if (s) hits.push({ index: m.index ?? 0, skill: s })
  }
  for (const m of text.matchAll(ctxRe)) {
    const s = ctxMap.get(m[1] ?? '')
    if (s) hits.push({ index: m.index ?? 0, skill: s })
  }
  hits.sort((a, b) => a.index - b.index)
  const seen = new Set<string>()
  const out: string[] = []
  for (const h of hits) {
    if (!seen.has(h.skill)) {
      seen.add(h.skill)
      out.push(h.skill)
    }
  }
  return out
}
