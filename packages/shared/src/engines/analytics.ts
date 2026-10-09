import { APPLICATION_STATUSES } from '../schemas/application'
import type { Application, ApplicationStatus } from '../schemas/application'
import type { AnalyticsData, DashboardStats } from '../schemas/analytics'

const INTERVIEW_STATUSES: ApplicationStatus[] = ['interview', 'technical_interview', 'final_interview']
const INACTIVE: ApplicationStatus[] = ['saved', 'rejected', 'withdrawn', 'offer']
const DAY = 86_400_000

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? round1((a / b) * 100) : 0)
const reachedInterview = (a: Application) => INTERVIEW_STATUSES.includes(a.status) || a.history.some((h) => INTERVIEW_STATUSES.includes(h.status))
const isSubmitted = (a: Application) => a.status !== 'saved'
const ts = (s: string | undefined) => {
  const t = s ? Date.parse(s) : NaN
  return Number.isNaN(t) ? null : t
}

/** Dashboard counters (SRD §14). */
export function computeDashboardStats(applications: Application[], savedJobs: number): DashboardStats {
  const submitted = applications.filter(isSubmitted)
  const interviews = applications.filter(reachedInterview).length
  const offers = applications.filter((a) => a.status === 'offer').length
  return {
    totalApplications: applications.length,
    savedJobs,
    active: applications.filter((a) => !INACTIVE.includes(a.status)).length,
    interviews,
    offers,
    rejections: applications.filter((a) => a.status === 'rejected').length,
    interviewRate: pct(interviews, submitted.length),
    offerRate: pct(offers, submitted.length),
  }
}

function mondayOf(t: number): number {
  const d = new Date(t)
  const day = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY
}
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)

function topN(values: (string | undefined)[], n: number): { label: string; count: number }[] {
  const m = new Map<string, number>()
  for (const v of values) {
    const k = v?.trim()
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([label, count]) => ({ label, count }))
}

const BUCKETS = [
  { label: '<50', test: (s: number) => s < 50 },
  { label: '50–69', test: (s: number) => s >= 50 && s < 70 },
  { label: '70–84', test: (s: number) => s >= 70 && s < 85 },
  { label: '85+', test: (s: number) => s >= 85 },
]

/** Full analytics (SRD §16). Insights are facts derived from the data (plus at most one marked suggestion). */
export function computeAnalytics(applications: Application[], savedJobs: number, now: Date = new Date()): AnalyticsData {
  const stats = computeDashboardStats(applications, savedJobs)
  const submitted = applications.filter(isSubmitted)

  // ---- time series
  const thisMonday = mondayOf(now.getTime())
  const weeks = Array.from({ length: 12 }, (_, i) => thisMonday - (11 - i) * 7 * DAY)
  const weekCount = new Map(weeks.map((w) => [w, 0]))
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const monthCount = new Map(months.map((m) => [m, 0]))
  for (const a of applications) {
    const t = ts(a.appliedAt || a.createdAt)
    if (t === null) continue
    const w = mondayOf(t)
    if (weekCount.has(w)) weekCount.set(w, weekCount.get(w)! + 1)
    const m = new Date(t).toISOString().slice(0, 7)
    if (monthCount.has(m)) monthCount.set(m, monthCount.get(m)! + 1)
  }

  // ---- distributions
  const byStatus = APPLICATION_STATUSES.map((status) => ({ status, count: applications.filter((a) => a.status === status).length })).filter((s) => s.count > 0)

  // ---- timing
  const toInterview: number[] = []
  const transitions = new Map<string, { from: ApplicationStatus; to: ApplicationStatus; total: number; n: number }>()
  for (const a of applications) {
    const hist = a.history.map((h) => ({ status: h.status, t: ts(h.at) })).filter((h): h is { status: ApplicationStatus; t: number } => h.t !== null).sort((x, y) => x.t - y.t)
    const firstInterview = hist.find((h) => INTERVIEW_STATUSES.includes(h.status))
    if (firstInterview) {
      const start = hist.find((h) => h.status === 'applied')?.t ?? ts(a.appliedAt) ?? ts(a.createdAt)
      if (start !== null && firstInterview.t >= start) toInterview.push((firstInterview.t - start) / DAY)
    }
    for (let i = 1; i < hist.length; i++) {
      const from = hist[i - 1]!
      const to = hist[i]!
      if (from.status === to.status) continue
      const key = `${from.status}>${to.status}`
      const cur = transitions.get(key) ?? { from: from.status, to: to.status, total: 0, n: 0 }
      cur.total += (to.t - from.t) / DAY
      cur.n++
      transitions.set(key, cur)
    }
  }
  const order = (s: ApplicationStatus) => APPLICATION_STATUSES.indexOf(s)
  const avgDaysBetweenStages = [...transitions.values()]
    .sort((a, b) => order(a.from) - order(b.from) || order(a.to) - order(b.to))
    .map((t) => ({ from: t.from, to: t.to, days: round1(t.total / t.n) }))
  const avgDaysToInterview = toInterview.length ? round1(toInterview.reduce((a, b) => a + b, 0) / toInterview.length) : null

  // ---- match vs outcome
  const scored = submitted.filter((a) => typeof a.matchScore === 'number')
  const matchVsOutcome = BUCKETS.map((b) => {
    const inB = scored.filter((a) => b.test(a.matchScore!))
    const interviews = inB.filter(reachedInterview).length
    return { bucket: b.label, applications: inB.length, interviews, rate: pct(interviews, inB.length) }
  })

  // ---- insights (facts only; minimum sample sizes)
  const insights: AnalyticsData['insights'] = []
  const MIN = 5
  if (submitted.length >= MIN) {
    insights.push({ kind: 'fact', text: `You have submitted ${submitted.length} applications; ${stats.interviews} reached an interview stage (${stats.interviewRate}%).` })
  }
  if (stats.rejections >= 3 && submitted.length >= MIN) {
    insights.push({ kind: 'fact', text: `${stats.rejections} of ${submitted.length} submitted applications ended in rejection (${pct(stats.rejections, submitted.length)}%).` })
  }
  for (const b of matchVsOutcome) {
    if (b.applications >= MIN) {
      insights.push({ kind: 'fact', text: `Applications with ${b.bucket}% match reached interview ${b.rate}% of the time (${b.interviews} of ${b.applications}).` })
    }
  }
  if (toInterview.length >= 3 && avgDaysToInterview !== null) {
    insights.push({ kind: 'fact', text: `On average, applications reached an interview stage ${avgDaysToInterview} days after applying (based on ${toInterview.length} applications).` })
  }
  const topCompany = topN(applications.map((a) => a.company), 1)[0]
  if (topCompany && topCompany.count >= 3) {
    insights.push({ kind: 'fact', text: `You have ${topCompany.count} applications to ${topCompany.label}.` })
  }
  const enough = matchVsOutcome.filter((b) => b.applications >= MIN)
  if (enough.length >= 2) {
    const lo = enough[0]!
    const hi = enough[enough.length - 1]!
    if (hi.rate - lo.rate >= 15) {
      insights.push({ kind: 'suggestion', text: `Suggestion: in your data, higher-match applications (${hi.bucket}%) reached interview more often than lower-match ones (${lo.bucket}%). With small samples this may be coincidence, but you could prioritize roles you match well.` })
    }
  }

  return {
    stats,
    rejectionRate: pct(stats.rejections, submitted.length),
    perWeek: weeks.map((w) => ({ week: isoDay(w), count: weekCount.get(w) ?? 0 })),
    perMonth: months.map((m) => ({ month: m, count: monthCount.get(m) ?? 0 })),
    byStatus,
    byEmploymentType: topN(applications.map((a) => a.employmentType || 'Unspecified'), 8),
    byCompany: topN(applications.map((a) => a.company), 8),
    byLocation: topN(applications.map((a) => a.location), 8),
    avgDaysToInterview,
    avgDaysBetweenStages,
    matchVsOutcome,
    insights,
  }
}

/** Flat application view of a tracked job for the analytics engine (D9). */
export function jobToApplication(job: import('../schemas/job').Job, matchScore?: number): Application {
  return {
    id: job.id,
    jobId: job.id,
    company: job.company,
    jobTitle: job.title,
    status: job.status,
    appliedAt: job.appliedAt,
    location: job.location,
    employmentType: job.employmentType,
    tags: job.tags,
    interviewDates: job.interviewDates,
    matchScore,
    history: job.history,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}
