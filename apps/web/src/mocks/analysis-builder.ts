import type { Analysis, CandidateBundle, Job } from '@copilot/shared'

/** The pipeline itself lives in packages/shared (engines/analysis.ts), shared with the API. */
export { buildAnalysis, type BuildAnalysisArgs } from '@copilot/shared'

const metricFree = (s: string) => !/\d/.test(s) && !s.includes('[add metric]')
const stripEnd = (s: string) => s.trim().replace(/[.!?;:,\s]+$/, '')

/** AI Pro style tailoring for an analysis: rephrases REAL resume/profile content only; never adds facts. */
export function aiTailoringFor(
  candidate: CandidateBundle,
  job: Job,
  base: Analysis['tailoring'],
  at: string,
): Analysis['tailoring'] {
  const strong = base.keywords.filter((k) => k.present).map((k) => k.keyword)
  const latest = [...candidate.experience].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate),
  )[0]
  const years = candidate.profile?.yearsExperience
  const summary = [
    latest
      ? `${latest.title} at ${latest.company}`
      : (candidate.profile?.targetTitles[0] ?? 'Candidate'),
    years && years > 0 ? `with ${years} years of experience` : '',
    strong.length ? `working hands-on with ${strong.slice(0, 4).join(', ')}` : '',
    `applying for the ${job.title} role at ${job.company}`,
  ]
    .filter(Boolean)
    .join(', ')
  const skillSet = strong.map((s) => s.toLowerCase())
  const bullets: Analysis['tailoring']['bulletSuggestions'] = []
  for (const e of candidate.experience) {
    for (const b of e.bullets) {
      if (bullets.length >= 4) break
      if (!skillSet.some((s) => b.toLowerCase().includes(s)) && bullets.length >= 2) continue
      const text = stripEnd(b)
      const needsMetric = metricFree(text)
      const suggested = needsMetric
        ? `${text} [add metric]`
        : text.charAt(0).toUpperCase() + text.slice(1)
      if (suggested === b) continue
      bullets.push({
        id: `aisug_${bullets.length + 1}_${job.id}`,
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
    summary: `${summary}.`,
    bulletSuggestions: bullets,
    source: 'ai',
    createdAt: at,
  }
}
