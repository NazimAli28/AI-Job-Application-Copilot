import {
  computeMatch,
  normalizeSkill,
  parseJobDescription,
  type Job,
  type MatchResult,
  type ParsedJob,
} from '@copilot/shared'
import type { UserData } from '../db'
import { bundleOf, now } from '../utils'

const clean = (s: string) => s.replace(/^[\s\-–•*·\d.)]+/, '').replace(/\s+/g, ' ').trim()

/** "AI" parse = rules parse + tidier title/company guesses and cleaned bullets. Never adds requirements. */
export function improveParse(text: string): ParsedJob {
  const p = parseJobDescription(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const first = lines[0] ?? ''
  const at = first.match(/^(.{3,80}?)\s+(?:at|@|-|–|\|)\s+(.{2,60})$/i)
  const company = text.match(/^\s*(?:company|employer)\s*[:-]\s*(.+)$/im)?.[1]
  const seen = new Set<string>()
  const responsibilities = p.responsibilities
    .map(clean)
    .filter((r) => r.length > 8 && !seen.has(r.toLowerCase()) && !!seen.add(r.toLowerCase()))
  return {
    ...p,
    title: p.title || (at ? clean(at[1]) : first.length < 80 ? clean(first) : undefined),
    company: p.company || company?.trim() || (at ? clean(at[2]) : undefined),
    responsibilities,
    requirements: p.requirements.map((r) => ({ ...r, text: clean(r.text) })),
  }
}

export function recompute(d: UserData, job: Job): MatchResult {
  const m = computeMatch(bundleOf(d, job), job)
  const manual = new Set(
    d.skills.filter((s) => s.source === 'manual').map((s) => (normalizeSkill(s.name) ?? s.name).toLowerCase()),
  )
  m.skills = m.skills.map((s) => (manual.has(s.skill.toLowerCase()) ? { ...s, corrected: s.corrected ?? true } : s))
  d.matches[job.id] = m
  return m
}

export function aiMatch(base: MatchResult, job: Job): MatchResult {
  const by = (st: string) => base.skills.filter((s) => s.status === st)
  const strong = by('strong').map((s) => s.skill)
  const gaps = base.skills.filter((s) => s.status === 'missing' || s.status === 'partial')
  const reqGaps = gaps.filter((s) => s.requirementKind === 'required')
  const unknown = by('unknown')
  const parts = [
    `Estimated fit for ${job.title} at ${job.company} is ${Math.round(base.score)}/100, based only on skills and experience documented in your profile and resume.`,
    strong.length
      ? `Your clearest strengths are ${strong.slice(0, 4).join(', ')}, each backed by evidence you provided.`
      : 'No requirement is strongly evidenced yet, so this estimate is conservative.',
    reqGaps.length
      ? `The main risk is ${reqGaps
          .slice(0, 3)
          .map((s) => s.skill)
          .join(', ')}, which the posting lists as required.`
      : 'You cover the required skills that could be verified from your data.',
    unknown.length ? `${unknown.length} requirement(s) could not be assessed; confirm them if they apply to you.` : '',
    base.experienceAlignment.detail,
  ]
  const ordered = reqGaps.concat(gaps.filter((g) => g.requirementKind === 'preferred')).slice(0, 5)
  const plan = ordered.map(
    (g, i) =>
      `${i + 1}. ${g.skill} (${g.requirementKind}): ${
        g.status === 'partial'
          ? 'strengthen related experience with a concrete project or bullet'
          : 'complete a short hands-on project and add it to your profile as evidence'
      }.`,
  )
  return {
    ...base,
    source: 'ai',
    explanation: parts.filter(Boolean).join(' '),
    recommendations: plan.length ? plan : base.recommendations,
    computedAt: now(),
  }
}
