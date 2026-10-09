import { randomUUID } from 'node:crypto'
import {
  computeMatch,
  tailorResume,
  type BulletSuggestion,
  type CandidateBundle,
  type InterviewQuestion,
  type Job,
  type MatchResult,
  type TailoringResult,
} from '@copilot/shared'

/**
 * Simulated AI Pro output (same as the prototype mocks) until Phase 8 wires Claude.
 * Everything is built from the candidate's real data only — never adds facts.
 */
const now = () => new Date().toISOString()
const shortId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`
const metricFree = (s: string) => !/\d/.test(s) && !s.includes('[add metric]')
const stripEnd = (s: string) => s.trim().replace(/[.!?;:,\s]+$/, '')

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
    unknown.length
      ? `${unknown.length} requirement(s) could not be assessed; confirm them if they apply to you.`
      : '',
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

/** Rephrases REAL profile content only; numbers are never invented ("[add metric]" placeholder). */
export function aiTailoring(bundle: CandidateBundle, profile: CandidateBundle, job: Job) {
  const match = computeMatch(bundle, job)
  const base = tailorResume(bundle, job, match)
  const strong = match.skills.filter((s) => s.status === 'strong').map((s) => s.skill)
  const p = profile.profile
  const latest = [...profile.experience].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate),
  )[0]
  const parts = [
    latest ? `${latest.title} at ${latest.company}` : (p?.targetTitles[0] ?? 'Candidate'),
    p && p.yearsExperience > 0 ? `with ${p.yearsExperience} years of experience` : '',
    strong.length ? `working hands-on with ${strong.slice(0, 4).join(', ')}` : '',
    `applying for the ${job.title} role at ${job.company}`,
  ].filter(Boolean)
  const skillSet = strong.map((s) => s.toLowerCase())
  const bullets: BulletSuggestion[] = []
  for (const e of profile.experience) {
    for (const b of e.bullets) {
      if (bullets.length >= 4) break
      const relevant = skillSet.some((s) => b.toLowerCase().includes(s))
      if (!relevant && bullets.length >= 2) continue
      const text = stripEnd(b)
      const needsMetric = metricFree(text)
      const suggested = needsMetric
        ? `${text} [add metric]`
        : text.charAt(0).toUpperCase() + text.slice(1)
      if (suggested === b) continue
      bullets.push({
        id: shortId('sug'),
        section: `${e.title} @ ${e.company}`,
        original: b,
        suggested,
        reason: needsMetric
          ? 'Reworded for clarity. If you have a real number (scale, time saved, users), replace "[add metric]" - otherwise delete it.'
          : 'Reworded to lead with the action and keep your original figures.',
        status: 'pending',
      })
    }
  }
  return {
    ...base,
    summary: `${parts.join(', ')}.`,
    bulletSuggestions: bullets,
    source: 'ai',
    createdAt: now(),
  } satisfies TailoringResult
}

export const aiLetterNote =
  '\n\n(Drafted with AI Pro from your profile facts only. Review and edit before sending.)'

/** Candidate-specific questions built only from the user's real profile data. */
export function aiQuestions(profile: CandidateBundle, job: Job): InterviewQuestion[] {
  const out: InterviewQuestion[] = []
  const exp = profile.experience[0]
  const project = profile.projects[0]
  const skill = profile.skills.find((s) => s.status === 'confirmed')
  const mk = (q: Omit<InterviewQuestion, 'id' | 'type'>): InterviewQuestion => ({
    id: shortId('iq_ai'),
    type: 'candidate',
    ...q,
  })
  if (exp)
    out.push(
      mk({
        question: `At ${exp.company} you worked as ${exp.title}. Which part of that role best prepares you for ${job.title} at ${job.company}?`,
        why: 'Interviewers test whether you can connect past work to the new role without being prompted.',
        answerStructure:
          'Pick one responsibility, describe the situation, your action, the measurable result, then link it to the new role.',
        hints: [
          `Draw on your time at ${exp.company}`,
          ...(exp.bullets[0]
            ? [`You listed: "${exp.bullets[0]}" — expand on it with numbers`]
            : []),
          ...(exp.technologies.length
            ? [`Mention hands-on use of ${exp.technologies.slice(0, 3).join(', ')}`]
            : []),
        ],
        difficulty: 'medium',
      }),
    )
  if (project)
    out.push(
      mk({
        question: `Walk me through "${project.name}". What was the hardest decision you made and what would you change now?`,
        why: 'Projects reveal ownership, trade-off thinking and honesty about mistakes.',
        answerStructure:
          'Goal, your role, one key decision with alternatives considered, outcome, retrospective.',
        hints: ['Be clear about what you personally built', 'Name one honest trade-off or regret'],
        difficulty: 'medium',
      }),
    )
  if (skill)
    out.push(
      mk({
        question: `Your profile lists ${skill.name}. Describe a situation where you relied on it under real constraints.`,
        why: 'They want evidence behind a listed skill, not just the keyword.',
        answerStructure: 'Context, the constraint, what you did with the skill, the result.',
        hints: [
          skill.evidence
            ? `Use your own evidence: "${skill.evidence}"`
            : `Prepare one concrete example of using ${skill.name}`,
        ],
        skill: skill.name,
        difficulty: 'hard',
      }),
    )
  return out
}
