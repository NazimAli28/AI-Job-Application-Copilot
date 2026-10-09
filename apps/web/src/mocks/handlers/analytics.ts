import { http } from 'msw'
import { buildAnalytics, buildDashboard, previewAiInsights, type ScoredJobs } from '@copilot/shared'
import type { UserData } from '../db'
import { aiAllowed, aiLatency, auth, latency, ok } from '../utils'

/** Same shared engines as apps/api (`modules/analytics`). */
const scoredJobs = (d: UserData): ScoredJobs => ({
  jobs: d.jobs,
  scores: Object.fromEntries(d.jobs.map((j) => [j.id, d.matches[j.id]?.score])),
})

export const analyticsHandlers = [
  http.get('/api/dashboard', async () => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const { data: d } = a
    return ok(
      buildDashboard({
        ...scoredJobs(d),
        resumes: d.resumes.length,
        profile: !!d.profile && d.skills.length > 0 && d.experience.length > 0,
        onboardingComplete: d.onboardingComplete,
      }),
    )
  }),

  http.get('/api/analytics', async () => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    return ok(buildAnalytics(scoredJobs(a.data)))
  }),

  http.post('/api/analytics/ai-insights', async () => {
    const a = auth()
    if (a instanceof Response) return a
    const denied = aiAllowed(a.user)
    if (denied) return denied
    await aiLatency()
    return ok(previewAiInsights(scoredJobs(a.data)))
  }),
]
