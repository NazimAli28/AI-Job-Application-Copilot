import { describe, expect, it } from 'vitest'
import { computeAnalytics, computeDashboardStats, jobToApplication } from '../analytics'
import type { ApplicationStatus } from '../../schemas/application'
import { makeApp, makeJob } from './fixtures'

const NOW = new Date('2026-10-07T12:00:00.000Z') // Wednesday

describe('computeDashboardStats', () => {
  it('counts active, interviews, offers and rates of submitted applications', () => {
    const apps = [
      makeApp('saved'),
      makeApp('applied'),
      makeApp('screening'),
      makeApp('interview'),
      makeApp('rejected', { history: [{ status: 'applied', at: '2026-09-01' }, { status: 'technical_interview', at: '2026-09-10' }, { status: 'rejected', at: '2026-09-20' }] }),
      makeApp('offer', { history: [{ status: 'applied', at: '2026-09-01' }, { status: 'final_interview', at: '2026-09-10' }, { status: 'offer', at: '2026-09-20' }] }),
      makeApp('withdrawn'),
    ]
    const s = computeDashboardStats(apps, 3)
    expect(s).toMatchObject({ totalApplications: 7, savedJobs: 3, active: 3, interviews: 3, offers: 1, rejections: 1 })
    expect(s.interviewRate).toBe(50) // 3 of 6 submitted
    expect(s.offerRate).toBe(16.7)
  })

  it('returns zero rates when nothing is submitted', () => {
    const s = computeDashboardStats([makeApp('saved')], 1)
    expect(s.interviewRate).toBe(0)
    expect(s.offerRate).toBe(0)
    expect(computeDashboardStats([], 0).active).toBe(0)
  })
})

describe('computeAnalytics', () => {
  it('builds 12 weekly and 6 monthly buckets including zeros', () => {
    const apps = [makeApp('applied', { appliedAt: '2026-10-05' }), makeApp('applied', { appliedAt: '2026-10-06' }), makeApp('applied', { createdAt: '2026-08-15T00:00:00.000Z' })]
    const a = computeAnalytics(apps, 0, NOW)
    expect(a.perWeek).toHaveLength(12)
    expect(a.perWeek[11]).toEqual({ week: '2026-10-05', count: 2 })
    expect(a.perWeek[0]!.week).toBe('2026-07-20')
    expect(a.perMonth.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(a.perMonth.find((m) => m.month === '2026-10')!.count).toBe(2)
    expect(a.perMonth.find((m) => m.month === '2026-08')!.count).toBe(1)
    expect(a.perMonth.find((m) => m.month === '2026-06')!.count).toBe(0)
  })

  it('computes distributions, timing and stage durations', () => {
    const apps = [
      makeApp('interview', { company: 'Acme', location: 'Remote', employmentType: 'full-time', history: [{ status: 'applied', at: '2026-09-01T00:00:00Z' }, { status: 'screening', at: '2026-09-04T00:00:00Z' }, { status: 'interview', at: '2026-09-11T00:00:00Z' }] }),
      makeApp('interview', { company: 'Acme', location: 'Remote', history: [{ status: 'applied', at: '2026-09-01T00:00:00Z' }, { status: 'screening', at: '2026-09-02T00:00:00Z' }, { status: 'interview', at: '2026-09-05T00:00:00Z' }] }),
      makeApp('rejected', { company: 'Beta' }),
    ]
    const a = computeAnalytics(apps, 0, NOW)
    expect(a.byStatus).toEqual([{ status: 'applied', count: 0 }, { status: 'interview', count: 2 }, { status: 'rejected', count: 1 }].filter((s) => s.count > 0))
    expect(a.byCompany[0]).toEqual({ label: 'Acme', count: 2 })
    expect(a.byLocation).toEqual([{ label: 'Remote', count: 2 }])
    expect(a.byEmploymentType.map((e) => e.label)).toEqual(expect.arrayContaining(['full-time', 'Unspecified']))
    expect(a.avgDaysToInterview).toBe(7) // (10 + 4) / 2
    const s2i = a.avgDaysBetweenStages.find((x) => x.from === 'screening' && x.to === 'interview')!
    expect(s2i.days).toBe(5) // (7 + 3) / 2
    expect(a.rejectionRate).toBe(33.3)
  })

  it('buckets match score vs interview outcome and writes factual insights', () => {
    const mk = (score: number, status: ApplicationStatus) => makeApp(status, { matchScore: score })
    const apps = [
      mk(72, 'interview'), mk(75, 'interview'), mk(80, 'rejected'), mk(78, 'applied'), mk(71, 'rejected'),
      mk(30, 'rejected'), mk(40, 'applied'),
    ]
    const a = computeAnalytics(apps, 0, NOW)
    const b = a.matchVsOutcome.find((x) => x.bucket === '70–84')!
    expect(b).toEqual({ bucket: '70–84', applications: 5, interviews: 2, rate: 40 })
    expect(a.matchVsOutcome.map((x) => x.bucket)).toEqual(['<50', '50–69', '70–84', '85+'])
    const facts = a.insights.filter((i) => i.kind === 'fact').map((i) => i.text)
    expect(facts).toContain('Applications with 70–84% match reached interview 40% of the time (2 of 5).')
    // buckets with fewer than 5 applications generate no insight (minimum sample size)
    expect(facts.some((t) => t.includes('<50%'))).toBe(false)
    expect(a.insights.filter((i) => i.kind === 'suggestion').length).toBeLessThanOrEqual(1)
  })

  it('produces no insights for tiny samples and handles empty data', () => {
    expect(computeAnalytics([makeApp('applied')], 0, NOW).insights).toEqual([])
    const e = computeAnalytics([], 0, NOW)
    expect(e.avgDaysToInterview).toBeNull()
    expect(e.perWeek.every((w) => w.count === 0)).toBe(true)
    expect(e.stats.interviewRate).toBe(0)
  })
})

describe('jobToApplication', () => {
  it('derives the flat application view from a tracked job and feeds the engine', () => {
    const history = [
      { status: 'applied' as const, at: '2026-09-01' },
      { status: 'interview' as const, at: '2026-09-10' },
    ]
    const jobs = [
      makeJob({ id: 'a', status: 'interview', appliedAt: '2026-09-01', history, tags: ['x'], location: 'Remote', employmentType: 'full-time', interviewDates: ['2026-10-20T10:00:00.000Z'] }),
      makeJob({ id: 'b', status: 'saved' }),
    ]
    const app = jobToApplication(jobs[0]!, 82)
    expect(app).toMatchObject({ id: 'a', jobId: 'a', company: jobs[0]!.company, jobTitle: jobs[0]!.title, status: 'interview', appliedAt: '2026-09-01', matchScore: 82, tags: ['x'], location: 'Remote', employmentType: 'full-time', history })
    const apps = jobs.filter((j) => j.status !== 'saved').map((j) => jobToApplication(j))
    expect(computeDashboardStats(apps, 1)).toMatchObject({ totalApplications: 1, savedJobs: 1, interviews: 1, active: 1 })
  })
})
