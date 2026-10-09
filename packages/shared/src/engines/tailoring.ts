import type { CandidateBundle } from '../schemas/profile'
import type { BulletSuggestion, Job, MatchResult, TailoringResult } from '../schemas/job'
import { extractSkills, normalizeSkill } from './skills'
import { rewriteWeakOpener, weakOpenerOf } from './data/strong-verbs'

const canon = (s: string) => normalizeSkill(s) ?? s

const joinList = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** Rule-based tailoring: keyword gaps, skill ordering, evidence prompts. No invented facts. */
export function tailorResume(candidate: CandidateBundle, job: Job, match: MatchResult): TailoringResult {
  const jobSkills = job.requirements.filter((r) => r.category === 'skill').map((r) => ({ name: r.skill ?? r.text, kind: r.kind }))
  const required = new Set(jobSkills.filter((s) => s.kind === 'required').map((s) => canon(s.name)))
  const preferred = new Set(jobSkills.filter((s) => s.kind === 'preferred').map((s) => canon(s.name)))

  // ---- skill order (rejected excluded)
  const visible = candidate.skills.filter((s) => s.status !== 'rejected')
  const rank = (name: string) => (required.has(canon(name)) ? 0 : preferred.has(canon(name)) ? 1 : 2)
  const skillOrder = visible
    .map((s, i) => ({ name: s.name, i, r: rank(s.name), learning: s.status === 'learning' }))
    .sort((a, b) => a.r - b.r || Number(a.learning) - Number(b.learning) || a.i - b.i)
    .map((s) => s.name)

  // ---- keywords
  const inSkills = new Set(visible.map((s) => canon(s.name)))
  const inBullets = new Set<string>()
  for (const e of candidate.experience) for (const s of extractSkills(`${e.bullets.join('\n')}`)) inBullets.add(s)
  const rejected = new Set(candidate.skills.filter((s) => s.status === 'rejected').map((s) => canon(s.name)))
  const matchBySkill = new Map(match.skills.map((m) => [canon(m.skill), m]))
  const keywords = jobSkills.map((js) => {
    const c = canon(js.name)
    const m = matchBySkill.get(c)
    const evidenced = !rejected.has(c) && (inBullets.has(c) || m?.status === 'strong')
    const listed = inSkills.has(c)
    const present = !rejected.has(c) && (evidenced || listed)
    let suggestion: string
    if (present && inBullets.has(c)) suggestion = 'Already in your resume — keep it visible in the top third.'
    else if (present && listed) suggestion = `You list ${js.name} in Skills but not in any bullet — mention it where you actually used it.`
    else if (present) suggestion = 'Already in your resume — keep it visible in the top third.'
    else if (m?.status === 'partial') suggestion = `You have related evidence (${m.evidence[0] ?? 'see match details'}) — only mention ${js.name} if you genuinely used it.`
    else suggestion = 'Missing — only add if you genuinely have this experience.'
    return { keyword: js.name, present, suggestion }
  })

  // ---- bullet suggestions (opener rephrase only)
  const bulletSuggestions: BulletSuggestion[] = []
  for (const e of candidate.experience) {
    e.bullets.forEach((b, idx) => {
      if (bulletSuggestions.length >= 12) return
      const weak = weakOpenerOf(b)
      const suggested = weak ? rewriteWeakOpener(b) : null
      if (weak && suggested && suggested !== b) {
        bulletSuggestions.push({
          id: `bs-${e.id}-${idx + 1}`,
          section: `Experience: ${e.title} @ ${e.company}`,
          original: b,
          suggested,
          reason: `"${weak}" is a weak opener. Starting with an action verb is clearer; the facts are unchanged — check the verb is accurate. Add a metric yourself if you have one.`,
          status: 'pending',
        })
      }
    })
  }

  // ---- section changes
  const sectionChanges: string[] = []
  const handsOn = /hands-on|portfolio|build|ship|prototype/i.test(job.description)
  if (candidate.projects.length && (handsOn || (candidate.profile?.yearsExperience ?? 0) < 2) && candidate.education.length) {
    sectionChanges.push('Move Projects above Education because the role values hands-on work.')
  }
  const reqMatched = match.skills.filter((s) => s.requirementKind === 'required' && (s.status === 'strong' || s.status === 'partial')).length
  const reqTotal = match.skills.filter((s) => s.requirementKind === 'required').length
  if (reqTotal) sectionChanges.push(`Keep Skills near the top: ${reqMatched} of ${reqTotal} required skills have supporting evidence in your profile.`)
  const projectOnly = match.skills.filter((s) => s.status === 'partial' && s.evidence.some((e) => e.startsWith('Project:')))
  for (const s of projectOnly.slice(0, 2)) sectionChanges.push(`${s.skill} appears only in a project — if you used it in a job, add it to that role's bullets too.`)
  if (match.conflicts.length === 0 && !sectionChanges.length) sectionChanges.push('Lead with your most relevant role and keep older roles brief.')

  // ---- summary (facts from profile only)
  let summary: string | undefined
  const p = candidate.profile
  if (p) {
    const latest = candidate.experience.find((e) => e.current) ?? candidate.experience[0]
    const title = latest?.title ?? p.targetTitles[0]
    const top = match.skills
      .filter((s) => s.status === 'strong')
      .sort((a, b) => Number(b.requirementKind === 'required') - Number(a.requirementKind === 'required'))
      .map((s) => s.skill)
      .slice(0, 3)
    const parts: string[] = []
    if (title) parts.push(`${title}${p.yearsExperience > 0 ? ` with ${p.yearsExperience} year${p.yearsExperience === 1 ? '' : 's'} of experience` : ''}.`)
    else if (p.yearsExperience > 0) parts.push(`Professional with ${p.yearsExperience} year${p.yearsExperience === 1 ? '' : 's'} of experience.`)
    if (top.length) parts.push(`Strengths include ${joinList(top)}.`)
    if (parts.length) summary = parts.join(' ')
  }

  return {
    jobId: job.id,
    ...(summary ? { summary } : {}),
    skillOrder,
    keywords,
    bulletSuggestions,
    sectionChanges,
    source: 'rules',
    createdAt: new Date().toISOString(),
  }
}
