import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description:
    'We are hiring a frontend engineer to build our React and TypeScript product. '.repeat(3),
  responsibilities: [],
  requirements: [],
}
const DAY = 86_400_000
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}
type Agent = Awaited<ReturnType<typeof signedIn>>

const addJob = async (a: Agent, extra: Record<string, unknown> = {}) =>
  (
    await a
      .post('/api/jobs')
      .send({ ...posting, ...extra })
      .expect(201)
  ).body.data as { id: string }

describe('GET /dashboard', () => {
  it('requires a session', async () => {
    await t.request().get('/api/dashboard').expect(401)
    await t.request().get('/api/analytics').expect(401)
  })

  it('is empty for a new user', async () => {
    const a = await signedIn()
    const { data } = (await a.get('/api/dashboard').expect(200)).body
    expect(data).toMatchObject({
      stats: { totalApplications: 0, savedJobs: 0, interviews: 0 },
      recent: [],
      counts: { jobs: 0, resumes: 0, profile: false },
      onboardingComplete: false,
    })
  })

  it('summarises the user’s jobs: stats, deadlines, next steps, interviews, archived only counted', async () => {
    const a = await signedIn()
    await addJob(a, { status: 'saved', applyBy: day(3) })
    await addJob(a, { status: 'saved', applyBy: day(-1), company: 'Late Co' })
    await addJob(a, { status: 'saved', applyBy: day(40) }) // beyond the 14-day horizon
    const applied = await addJob(a, {
      status: 'applied',
      nextAction: 'Email recruiter',
      nextActionAt: day(2),
      interviewDates: [new Date(Date.now() + 5 * DAY).toISOString()],
    })
    await a.post(`/api/jobs/${applied.id}/status`).send({ status: 'interview' }).expect(200)
    await addJob(a, { status: 'rejected' })
    await addJob(a, { title: 'Link only', description: '' })
    const archived = await addJob(a, { status: 'offer' })
    await a.post(`/api/jobs/${archived.id}/archive`).expect(200)

    const { data } = (await a.get('/api/dashboard').expect(200)).body
    expect(data.stats).toMatchObject({
      totalApplications: 2,
      savedJobs: 4,
      interviews: 1,
      rejections: 1,
      offers: 0, // the offer is archived
      interviewRate: 50,
    })
    expect(data.counts.jobs).toBe(7)
    expect(data.applySoon.map((j: { overdue: boolean }) => j.overdue)).toEqual([true, false])
    expect(data.applySoon[0].company).toBe('Late Co')
    expect(data.nextActions).toEqual([
      expect.objectContaining({ id: applied.id, nextAction: 'Email recruiter', overdue: false }),
    ])
    expect(data.upcomingInterviews).toEqual([expect.objectContaining({ jobId: applied.id })])
    expect(data.needsDescription.map((j: { title: string }) => j.title)).toEqual(['Link only'])
    expect(data.recent).toHaveLength(5)
  })

  it('never shows another user’s jobs', async () => {
    const a = await signedIn()
    await addJob(a, { status: 'applied' })
    const b = await signedIn(bob)
    const { data } = (await b.get('/api/dashboard').expect(200)).body
    expect(data.counts.jobs).toBe(0)
    expect((await b.get('/api/analytics').expect(200)).body.data.stats.totalApplications).toBe(0)
  })
})

describe('/analytics', () => {
  it('computes distributions and timings from non-archived applications', async () => {
    const a = await signedIn()
    for (const company of ['Acme', 'Acme', 'Globex'])
      await addJob(a, { status: 'applied', company })
    await addJob(a, { status: 'saved' })
    const { data } = (await a.get('/api/analytics').expect(200)).body
    expect(data.stats).toMatchObject({ totalApplications: 3, savedJobs: 1 })
    expect(data.byCompany[0]).toEqual({ label: 'Acme', count: 2 })
    expect(data.byStatus).toEqual([{ status: 'applied', count: 3 }])
    expect(data.perWeek).toHaveLength(12)
    expect(data.perWeek.at(-1).count).toBe(3)
    expect(data.matchVsOutcome).toHaveLength(4)
  })

  it('✨ insights need AI Pro and enough data', async () => {
    const a = await signedIn()
    await a.post('/api/analytics/ai-insights').expect(403)
    await a.post('/api/dev/tier').send({ aiAccess: true }).expect(200)
    const few = (await a.post('/api/analytics/ai-insights').expect(200)).body.data
    expect(few).toMatchObject({ insights: [], message: expect.stringContaining('0 of 5') })

    for (let i = 0; i < 5; i++) await addJob(a, { status: 'applied' })
    const { data } = (await a.post('/api/analytics/ai-insights').expect(200)).body
    expect(data.insights[0]).toMatchObject({
      kind: 'fact',
      text: expect.stringContaining('5 applications'),
    })
    expect(
      data.insights.every((i: { kind: string }) => ['fact', 'suggestion'].includes(i.kind)),
    ).toBe(true)
  })
})
