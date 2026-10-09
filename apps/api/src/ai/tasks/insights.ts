import { z } from 'zod'
import {
  buildAnalytics,
  previewAiInsights,
  type AiInsightsResult,
  type AnalyticsData,
  type ScoredJobs,
} from '@copilot/shared'
import { GUARDRAILS, inventedNumbers } from '../guard'
import { AiRejected, type AiTask } from '../service'

const schema = z.object({
  insights: z
    .array(z.object({ kind: z.enum(['fact', 'suggestion']), text: z.string() }))
    .min(1)
    .max(6),
})

/** Aggregates only — no posting text, no profile data. */
const statsOf = (a: AnalyticsData) =>
  JSON.stringify({
    stats: a.stats,
    rejectionRate: a.rejectionRate,
    perMonth: a.perMonth,
    byStatus: a.byStatus,
    byEmploymentType: a.byEmploymentType,
    byCompany: a.byCompany,
    byLocation: a.byLocation,
    avgDaysToInterview: a.avgDaysToInterview,
    avgDaysBetweenStages: a.avgDaysBetweenStages,
    matchVsOutcome: a.matchVsOutcome,
  })

/** ✨ Analytics insights from the user's own pipeline numbers. */
export const insightsTask: AiTask<ScoredJobs, z.infer<typeof schema>, AiInsightsResult> = {
  name: 'analytics-insights',
  tier: 'generate',
  maxTokens: 2000,
  schema,
  system: `${GUARDRAILS}

Task: give a job seeker 3-6 insights about their application pipeline from the statistics provided. "fact" = an observation directly supported by the numbers (quote them exactly); "suggestion" = one practical next step that follows from a fact. Small samples: say so instead of over-generalising. Never speculate about employers' reasons.`,
  prompt: (scored) => `<statistics>\n${statsOf(buildAnalytics(scored))}\n</statistics>`,
  toResult(out, scored) {
    const stats = statsOf(buildAnalytics(scored))
    const insights = out.insights
      .map((i) => ({ kind: i.kind, text: i.text.trim() }))
      .filter((i) => i.text && !inventedNumbers(i.text, stats).length)
    if (!insights.length) throw new AiRejected('every insight cited numbers not in the data')
    return { insights }
  },
  simulate: (scored) => previewAiInsights(scored),
}
