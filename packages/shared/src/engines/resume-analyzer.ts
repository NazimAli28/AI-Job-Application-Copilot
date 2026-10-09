import type { ParsedResume, ResumeAnalysis, ResumeIssue } from '../schemas/resume'
import { extractSkills, normalizeSkill } from './skills'
import { BULLET_RE, DATE_RANGE_RE, stripBullet } from './resume-parser'
import { ALL_STRONG_VERBS, rewriteWeakOpener, weakOpenerOf } from './data/strong-verbs'

type Cat = ResumeIssue['category']
const LABELS: Record<Cat, string> = { ats: 'ATS compatibility', skills: 'Skills', clarity: 'Clarity', achievements: 'Achievements', formatting: 'Formatting' }
const WEIGHTS: Record<Cat, number> = { ats: 0.25, skills: 0.2, clarity: 0.2, achievements: 0.25, formatting: 0.1 }
const SEVERITY_PENALTY = { high: 12, medium: 6, low: 3 } as const

const BUZZWORDS = [
  'hard-working', 'hardworking', 'hard working', 'team player', 'synergy', 'go-getter', 'go getter', 'detail-oriented',
  'detail oriented', 'results-driven', 'results driven', 'self-starter', 'think outside the box', 'proven track record',
  'highly motivated', 'people person', 'passionate', 'best of breed', 'guru', 'ninja', 'rockstar',
]
const PASSIVE_RE = /\b(?:was|were)\s+(?:\w+ly\s+)?(?:\w+ed|built|made|given|done|written|taken|chosen|led)\b/i
const FIRST_PERSON_RE = /\b(?:I|my|me|myself|I'm|I've)\b/
const KEY_SECTIONS: { key: string; label: string; severity: ResumeIssue['severity'] }[] = [
  { key: 'experience', label: 'Experience', severity: 'high' },
  { key: 'education', label: 'Education', severity: 'medium' },
  { key: 'skills', label: 'Skills', severity: 'medium' },
]

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function getBullets(parsed: ParsedResume, text: string): string[] {
  const fromParsed = parsed.experience.flatMap((e) => e.bullets).filter((b) => b.trim())
  if (fromParsed.length) return fromParsed
  return text.split('\n').filter((l) => BULLET_RE.test(l)).map(stripBullet).filter(Boolean)
}

function dateStyles(text: string): Set<string> {
  const styles = new Set<string>()
  const re = new RegExp(DATE_RANGE_RE.source, 'gi')
  for (const m of text.matchAll(re)) {
    for (const tok of [m[1]!, m[2]!]) {
      if (/^(present|current|now|ongoing|today)$/i.test(tok)) continue
      if (/[a-z]/i.test(tok)) styles.add('month-name')
      else if (/^\d{1,2}\/\d{4}$/.test(tok)) styles.add('mm/yyyy')
      else if (/^\d{4}-\d{1,2}$/.test(tok)) styles.add('yyyy-mm')
      else styles.add('yyyy')
    }
  }
  return styles
}

export function analyzeResume(parsed: ParsedResume, text: string, targetKeywords: string[] = []): ResumeAnalysis {
  const issues: ResumeIssue[] = []
  const obs: Record<Cat, string[]> = { ats: [], skills: [], clarity: [], achievements: [], formatting: [] }
  const push = (i: ResumeIssue) => issues.push(i)
  const wordCount = words(text).length
  const bullets = getBullets(parsed, text)
  const c = parsed.contact

  // ---- contact
  const missing: string[] = []
  if (!c.email) missing.push('email')
  if (!c.phone) missing.push('phone number')
  if (!c.name) missing.push('name')
  for (const m of missing) {
    push({ id: `missing-contact-${m.split(' ')[0]}`, severity: m === 'email' || m === 'name' ? 'high' : 'medium', category: 'ats', message: `No ${m} detected near the top of your resume.`, suggestion: `Add your ${m} on the first lines so recruiters and ATS parsers can find it.`, section: 'contact' })
  }
  if (!c.links.some((l) => /linkedin/i.test(l))) {
    push({ id: 'missing-linkedin', severity: 'low', category: 'ats', message: 'No LinkedIn profile link detected.', suggestion: 'Add your LinkedIn URL to the header if you have a profile.', section: 'contact' })
  }
  if (!missing.length) obs.ats.push('Contact details (name, email, phone) are easy to find.')

  // ---- sections
  for (const s of KEY_SECTIONS) {
    if (!parsed.sections.includes(s.key as never)) {
      push({ id: `missing-section-${s.key}`, severity: s.severity, category: 'ats', message: `No "${s.label}" section heading detected.`, suggestion: `Add a clearly labelled "${s.label}" heading; ATS systems rely on standard section names.`, section: s.key })
    }
  }
  if (!parsed.sections.includes('summary' as never)) {
    push({ id: 'missing-section-summary', severity: 'low', category: 'ats', message: 'No summary section detected.', suggestion: 'Consider a 2–3 line summary that states your role, years of experience and top skills (only facts that are true).', section: 'summary' })
  }
  obs.ats.push(`Detected sections: ${parsed.sections.length ? parsed.sections.join(', ') : 'none'}.`)

  // ---- length
  if (wordCount < 250) {
    push({ id: 'length-short', severity: 'medium', category: 'formatting', message: `Resume is very short (${wordCount} words).`, suggestion: 'Add more detail about your responsibilities, tools and results. Aim for roughly 300–800 words.' })
  } else if (wordCount > 1000) {
    push({ id: 'length-long', severity: 'medium', category: 'formatting', message: `Resume is long (${wordCount} words).`, suggestion: 'Trim older or less relevant roles and keep the strongest bullets. One to two pages is typical.' })
  }
  obs.formatting.push(`Word count: ${wordCount}.`)

  // ---- bullets
  let weakN = 0
  let noMetricN = 0
  let longN = 0
  let passiveN = 0
  let fpN = 0
  let shortN = 0
  let metricBullets = 0
  let weakCount = 0
  let strongOpeners = 0
  bullets.forEach((b, i) => {
    const wc = words(b).length
    const n = i + 1
    if (/\d|%|\$/.test(b)) metricBullets++
    const weak = weakOpenerOf(b)
    if (weak) {
      weakCount++
      if (weakN < 10) {
        weakN++
        const rewritten = rewriteWeakOpener(b)
        push({ id: `weak-verb-${n}`, severity: 'medium', category: 'clarity', message: `Bullet starts with a weak opener ("${weak}").`, original: b, suggestion: rewritten ? `Start with an action verb instead, e.g. "${rewritten}". Keep it only if it is accurate; other strong verbs: ${ALL_STRONG_VERBS.slice(0, 6).join(', ')}.` : `Start with an action verb such as ${ALL_STRONG_VERBS.slice(0, 6).join(', ')}.`, section: 'experience' })
      }
    } else if (ALL_STRONG_VERBS.includes(b.split(/\s+/)[0] ?? '')) strongOpeners++
    if (wc > 35 && longN < 5) {
      longN++
      push({ id: `long-bullet-${n}`, severity: 'low', category: 'clarity', message: `Bullet is long (${wc} words).`, original: b, suggestion: 'Split into two bullets or cut it to one clear idea (about 15–30 words).', section: 'experience' })
    }
    if (wc < 5 && wc > 0 && shortN < 3) {
      shortN++
      push({ id: `short-bullet-${n}`, severity: 'low', category: 'clarity', message: `Bullet is very short (${wc} words).`, original: b, suggestion: 'Say what you did, with which tools, and what it achieved.', section: 'experience' })
    }
    if (!/\d|%|\$/.test(b) && wc >= 5 && noMetricN < 8) {
      noMetricN++
      push({ id: `no-metric-${n}`, severity: 'medium', category: 'achievements', message: 'Bullet has no measurable result.', original: b, suggestion: 'Add a real metric if you have one: how many users or requests, what % improvement, how much time or cost saved? Only include numbers you can back up.', section: 'experience' })
    }
    if (PASSIVE_RE.test(b) && passiveN < 5) {
      passiveN++
      push({ id: `passive-${n}`, severity: 'low', category: 'clarity', message: 'Possible passive voice.', original: b, suggestion: 'Rewrite so you are the actor: "<verb> <what you did>" instead of "was <verb>ed".', section: 'experience' })
    }
    if (FIRST_PERSON_RE.test(b) && fpN < 3) {
      fpN++
      push({ id: `first-person-${n}`, severity: 'low', category: 'clarity', message: 'First-person pronoun in a bullet.', original: b, suggestion: 'Resume bullets conventionally drop "I/my" and start with the action verb.', section: 'experience' })
    }
  })
  if (parsed.summary && FIRST_PERSON_RE.test(parsed.summary)) {
    push({ id: 'first-person-summary', severity: 'low', category: 'clarity', message: 'Summary uses first-person pronouns.', original: parsed.summary, suggestion: 'Rephrase in an implied first person, e.g. "Frontend engineer with N years of experience…".', section: 'summary' })
  }

  // ---- buzzwords
  const lower = text.toLowerCase()
  let buzzN = 0
  for (const bw of BUZZWORDS) {
    if (new RegExp(`(?<![a-z])${bw.replace(/[-]/g, '[- ]')}(?![a-z])`, 'i').test(lower) && buzzN < 5) {
      buzzN++
      push({ id: `buzzword-${buzzN}`, severity: 'low', category: 'clarity', message: `Cliché detected: "${bw}".`, suggestion: bw.startsWith('detail') ? 'Claims like "detail-oriented" are not persuasive without evidence; show a specific example instead (e.g. a bug class you caught or a process you tightened).' : `Replace "${bw}" with a concrete example of what you did that demonstrates it.` })
    }
  }

  // ---- dates
  const styles = dateStyles(text)
  if (styles.size > 1) {
    push({ id: 'inconsistent-dates', severity: 'low', category: 'formatting', message: `Date formats are inconsistent (${[...styles].join(', ')}).`, suggestion: 'Pick one format (e.g. "Jan 2021 – Present") and use it for every role and degree.' })
  }

  // ---- skills
  const textSkills = new Set(extractSkills(text))
  const skillCount = Math.max(parsed.skills.length, textSkills.size)
  if (skillCount < 6) {
    push({ id: 'few-skills', severity: skillCount < 3 ? 'high' : 'medium', category: 'skills', message: `Only ${skillCount} recognizable skill${skillCount === 1 ? '' : 's'} found.`, suggestion: 'List the tools, languages and methods you genuinely use in a dedicated Skills section.', section: 'skills' })
  }
  obs.skills.push(`${skillCount} recognizable skills detected.`)

  const missingKw: string[] = []
  for (const kw of targetKeywords) {
    const canon = normalizeSkill(kw)
    const present = canon ? textSkills.has(canon) : lower.includes(kw.toLowerCase())
    if (!present) missingKw.push(kw)
  }
  missingKw.slice(0, 8).forEach((kw, i) => {
    push({ id: `missing-keyword-${i + 1}`, severity: 'medium', category: 'skills', message: `Target keyword "${kw}" not found in your resume.`, suggestion: `If you have genuinely used ${kw}, mention it in Skills and in the bullet where you used it. If not, do not add it.` })
  })
  if (targetKeywords.length) obs.skills.push(`${targetKeywords.length - missingKw.length} of ${targetKeywords.length} target keywords found.`)

  // ---- category scoring
  const penalty: Record<Cat, number> = { ats: 0, skills: 0, clarity: 0, achievements: 0, formatting: 0 }
  for (const i of issues) {
    if (i.id.startsWith('no-metric-')) continue // scored by ratio below
    penalty[i.category] += SEVERITY_PENALTY[i.severity]
  }
  const ratio = bullets.length ? metricBullets / bullets.length : 0
  const weakRatio = bullets.length ? weakCount / bullets.length : 0
  const kwRatio = targetKeywords.length ? (targetKeywords.length - missingKw.length) / targetKeywords.length : 1
  const scores: Record<Cat, number> = {
    ats: clamp(100 - penalty.ats),
    skills: clamp(Math.min(100, 40 + skillCount * 6) * (0.5 + 0.5 * kwRatio)),
    clarity: clamp(100 - penalty.clarity - weakRatio * 20),
    achievements: bullets.length ? clamp(25 + ratio * 75) : 35,
    formatting: clamp(100 - penalty.formatting - (bullets.length ? 0 : 25)),
  }
  if (!bullets.length) push({ id: 'no-bullets', severity: 'high', category: 'formatting', message: 'No bullet points detected under your experience.', suggestion: 'Describe each role with 3–5 bullets starting with action verbs.', section: 'experience' })

  obs.clarity.push(weakCount ? `${weakCount} of ${bullets.length} bullets start with a weak opener.` : 'No weak bullet openers found.')
  if (strongOpeners) obs.clarity.push(`${strongOpeners} bullets open with a strong action verb.`)
  obs.achievements.push(bullets.length ? `${metricBullets} of ${bullets.length} bullets contain a number, % or $ value.` : 'No bullets to evaluate for results.')
  obs.formatting.push(bullets.length ? `${bullets.length} bullet points detected.` : 'No bullet points detected.')

  const overall = clamp((Object.keys(WEIGHTS) as Cat[]).reduce((s, k) => s + scores[k] * WEIGHTS[k], 0))

  // ---- recommendations (prioritised)
  const recs: { p: number; t: string }[] = []
  if (missing.length) recs.push({ p: 100, t: `Add the missing contact details (${missing.join(', ')}) at the top of the resume.` })
  const missingSec = KEY_SECTIONS.filter((s) => !parsed.sections.includes(s.key as never)).map((s) => s.label)
  if (missingSec.length) recs.push({ p: 95, t: `Add clearly labelled section headings: ${missingSec.join(', ')}.` })
  if (noMetricN) recs.push({ p: 90, t: `Add real, verifiable metrics to your bullets (${bullets.length - metricBullets} have none): users, % improvement, time or cost saved.` })
  if (weakCount) recs.push({ p: 80, t: `Replace weak openers ("responsible for", "worked on", "helped") in ${weakCount} bullet${weakCount === 1 ? '' : 's'} with action verbs.` })
  if (missingKw.length) recs.push({ p: 85, t: `Cover target keywords you genuinely have: ${missingKw.slice(0, 5).join(', ')}.` })
  if (skillCount < 6) recs.push({ p: 75, t: 'Expand your Skills section with the tools and technologies you actually use.' })
  if (wordCount < 250) recs.push({ p: 70, t: 'Add more detail: your resume is shorter than recommended.' })
  if (wordCount > 1000) recs.push({ p: 70, t: 'Shorten the resume to the most relevant roles and bullets.' })
  if (buzzN) recs.push({ p: 50, t: 'Replace clichés (e.g. "team player", "hard-working") with specific examples.' })
  if (longN) recs.push({ p: 45, t: 'Shorten bullets over 35 words into one clear idea each.' })
  if (styles.size > 1) recs.push({ p: 40, t: 'Use one consistent date format throughout.' })
  if (passiveN || fpN) recs.push({ p: 35, t: 'Write bullets in active voice without "I/my".' })
  const fallback = ['Tailor the top third of your resume to each job description using only experience you really have.', 'Keep bullets to one idea each and lead with the result where possible.', 'Proofread for consistent tense: past tense for previous roles, present for the current one.']
  recs.sort((a, b) => b.p - a.p)
  const recommendations = recs.slice(0, 6).map((r) => r.t)
  for (const f of fallback) if (recommendations.length < 3) recommendations.push(f)

  return {
    overallScore: overall,
    categories: (Object.keys(WEIGHTS) as Cat[]).map((key) => ({ key, label: LABELS[key], score: scores[key], observations: obs[key] })),
    issues,
    recommendations,
    source: 'rules',
    analyzedAt: new Date().toISOString(),
  }
}
