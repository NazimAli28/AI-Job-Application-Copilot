import { createAiService } from '../../ai/service'
import { insightsTask } from '../../ai/tasks/insights'
import { buildAnalytics, buildDashboard, previewAiInsights, type ScoredJobs } from '@copilot/shared'
import type { AppContext } from '../../context'
import { jobService } from '../jobs/service'

/**
 * Dashboard + analytics (Phase 7, D21): computed from the user's tracked jobs and their last
 * rules-match scores with the same shared engines the prototype used — per-user data is small,
 * so one query + pure functions beats SQL aggregates and keeps the numbers identical.
 */
export function analyticsService(ctx: AppContext) {
  const { db } = ctx
  const jobs = jobService(ctx)
  const ai = createAiService(ctx)

  async function scoredJobs(userId: string): Promise<ScoredJobs> {
    const list = await jobs.list(userId, true) // archived count towards counts.jobs only
    return {
      jobs: list.map(({ matchScore: _m, needsDescription: _n, ...j }) => j),
      scores: Object.fromEntries(list.map((j) => [j.id, j.matchScore])),
    }
  }

  return {
    async dashboard(userId: string) {
      const [scored, resumes, skills, experience, profile, user] = await Promise.all([
        scoredJobs(userId),
        db.resume.count({ where: { userId } }),
        db.profileSkill.count({ where: { userId } }),
        db.experience.count({ where: { userId } }),
        db.profile.count({ where: { userId } }),
        db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardingComplete: true } }),
      ])
      return buildDashboard({
        ...scored,
        resumes,
        profile: profile > 0 && skills > 0 && experience > 0,
        onboardingComplete: user.onboardingComplete,
      })
    },

    async analytics(userId: string) {
      return buildAnalytics(await scoredJobs(userId))
    },

    /** ✨ Not persisted. Below the data minimum the explanation is returned without an AI call. */
    async aiInsights(userId: string) {
      const scored = await scoredJobs(userId)
      const preview = previewAiInsights(scored)
      if (!preview.insights.length) return preview
      return ai.run(userId, insightsTask, scored)
    },
  }
}
