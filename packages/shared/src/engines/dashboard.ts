import { needsDescription, type Job } from '../schemas/job'
import type { AiInsightsResult, AnalyticsData, DashboardData } from '../schemas/analytics'
import { computeAnalytics, computeDashboardStats, jobToApplication } from './analytics'

const DAY = 86_400_000
const dayStr = (t: number) => new Date(t).toISOString().slice(0, 10)
const brief = (j: Job) => ({ id: j.id, title: j.title, company: j.company, status: j.status })

/** Tracked jobs (archived included) + their rules match scores by job id. */
export type ScoredJobs = { jobs: Job[]; scores: Record<string, number | undefined> }

const live = (jobs: Job[]) => jobs.filter((j) => !j.archived)

/** Submitted (non-saved, non-archived) jobs as analytics applications + the saved count. */
export function applicationsOf({ jobs, scores }: ScoredJobs) {
  const l = live(jobs)
  return {
    applications: l
      .filter((j) => j.status !== 'saved')
      .map((j) => jobToApplication(j, scores[j.id])),
    savedJobs: l.filter((j) => j.status === 'saved').length,
  }
}

/** GET /analytics — same numbers for the mock and the API. */
export function buildAnalytics(input: ScoredJobs, now: Date = new Date()): AnalyticsData {
  const { applications, savedJobs } = applicationsOf(input)
  return computeAnalytics(applications, savedJobs, now)
}

/** GET /dashboard: stats, recent jobs, upcoming interviews, deadlines, missing descriptions, next steps. */
export function buildDashboard(
  input: ScoredJobs & { resumes: number; profile: boolean; onboardingComplete: boolean },
  now: Date = new Date(),
): DashboardData {
  const jobs = live(input.jobs)
  const t = now.getTime()
  const today = dayStr(t)
  const horizon = dayStr(t + 14 * DAY)
  const { applications, savedJobs } = applicationsOf(input)

  return {
    stats: computeDashboardStats(applications, savedJobs),
    recent: [...jobs]
      .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
      .slice(0, 5)
      .map((j) => ({
        ...brief(j),
        matchScore: input.scores[j.id],
        appliedAt: j.appliedAt,
        updatedAt: j.updatedAt,
      })),
    upcomingInterviews: jobs
      .flatMap((j) =>
        j.interviewDates
          .filter((at) => new Date(at).getTime() > t)
          .map((at) => ({ ...brief(j), jobId: j.id, at })),
      )
      .sort((x, y) => x.at.localeCompare(y.at)),
    applySoon: jobs
      .filter((j) => j.status === 'saved' && j.applyBy && j.applyBy <= horizon)
      .sort((x, y) => x.applyBy!.localeCompare(y.applyBy!))
      .map((j) => ({ ...brief(j), applyBy: j.applyBy!, overdue: j.applyBy! < today })),
    needsDescription: jobs
      .filter(needsDescription)
      .map((j) => ({ ...brief(j), createdAt: j.createdAt })),
    nextActions: jobs
      .filter((j) => j.nextActionAt)
      .sort((x, y) => x.nextActionAt!.localeCompare(y.nextActionAt!))
      .map((j) => ({
        ...brief(j),
        nextAction: j.nextAction ?? 'Follow up',
        nextActionAt: j.nextActionAt!,
        overdue: j.nextActionAt! < today,
      })),
    counts: { jobs: input.jobs.length, resumes: input.resumes, profile: input.profile },
    onboardingComplete: input.onboardingComplete,
  }
}

type Insight = AnalyticsData['insights'][number]
const MIN_AI_APPLICATIONS = 5

/**
 * Simulated ✨ insights (until Phase 8 wires Claude): built only from the computed numbers —
 * facts quote data, suggestions are labelled as such.
 */
export function previewAiInsights(input: ScoredJobs, now: Date = new Date()): AiInsightsResult {
  const { applications, savedJobs } = applicationsOf(input)
  if (applications.length < MIN_AI_APPLICATIONS)
    return {
      insights: [],
      message: `Not enough data yet: ${applications.length} of ${MIN_AI_APPLICATIONS} applications needed for meaningful insights.`,
    }
  const an = computeAnalytics(applications, savedJobs, now)
  const s = an.stats
  const out: Insight[] = [
    {
      kind: 'fact',
      text: `${s.totalApplications} applications tracked: ${s.interviews} reached an interview stage (${s.interviewRate}%), ${s.offers} offers (${s.offerRate}%), ${s.rejections} rejections (${an.rejectionRate}%).`,
    },
  ]
  if (an.avgDaysToInterview != null)
    out.push({
      kind: 'fact',
      text: `On average, it took ${an.avgDaysToInterview} days from applying to an interview.`,
    })
  const best = an.matchVsOutcome
    .filter((b) => b.applications > 0)
    .sort((x, y) => y.rate - x.rate)[0]
  if (best)
    out.push({
      kind: 'fact',
      text: `Your match-score bucket ${best.bucket} has the highest interview rate: ${best.rate}% (${best.interviews} of ${best.applications}).`,
    })
  const co = an.byCompany[0]
  if (co && co.count > 1)
    out.push({
      kind: 'fact',
      text: `You applied most often to ${co.label} (${co.count} applications).`,
    })
  if (s.interviewRate < 20)
    out.push({
      kind: 'suggestion',
      text: 'Suggestion: your interview rate is below 20%. Consider tailoring your resume per role using the Match and Tailoring tabs.',
    })
  if (best && best.applications >= 2)
    out.push({
      kind: 'suggestion',
      text: `Suggestion: consider prioritising roles in the ${best.bucket} match range, which has done best so far. This is a pattern in a small sample, not a guarantee.`,
    })
  out.push({
    kind: 'suggestion',
    text: 'Suggestion: follow up on applications with no status change for about two weeks.',
  })
  return { insights: out }
}
