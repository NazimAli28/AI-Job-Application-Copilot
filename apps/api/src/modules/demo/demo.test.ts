import { buildDemoData, validateDemoData } from '@copilot/shared/demo'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDb, testApp } from '../../test/helpers'
import { DEMO_USER_ID } from './seed'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const demoAgent = async () => {
  const agent = t.request()
  await agent.post('/api/auth/demo').expect(200)
  return agent
}

describe('server-side demo seed', () => {
  it('is consistent with the shared schemas', () => {
    expect(validateDemoData(buildDemoData())).toEqual([])
  })

  it('serves the seeded profile, resumes, jobs and pre-generated AI results', async () => {
    const seed = buildDemoData()
    const agent = await demoAgent()

    const profile = (await agent.get('/api/profile').expect(200)).body.data
    expect(profile.onboardingComplete).toBe(true)
    expect(profile.skills).toHaveLength(seed.skills.length)

    const jobs = (await agent.get('/api/jobs').expect(200)).body.data
    expect(jobs.length).toBe(seed.jobs.filter((j) => !j.archived).length)
    expect(jobs.find((j: { id: string }) => j.id === 'job_demo_1').matchScore).toBeGreaterThan(0)

    // ✨ buttons answer with the pre-generated results (no LLM call for the demo).
    const ai = await agent.post('/api/jobs/job_demo_1/match/ai').expect(200)
    expect(ai.body.data).toMatchObject({ source: 'ai', jobId: 'job_demo_1' })
    const tailor = await agent.post('/api/jobs/job_demo_1/tailoring/ai').expect(200)
    expect(tailor.body.data.source).toBe('ai')
    const aiResume = await agent.post('/api/resumes/res_demo_1/ai-analysis').expect(200)
    expect(aiResume.body.data).toEqual(seed.resumes[0]!.aiAnalysis)
    const letters = (await agent.get('/api/jobs/job_demo_1/cover-letters').expect(200)).body.data
    expect(letters.length).toBe(seed.coverLetters.length)

    const resumes = (await agent.get('/api/resumes').expect(200)).body.data
    expect(resumes.find((r: { id: string }) => r.id === 'res_demo_1').aiAnalysis).toBeTruthy()
    const pdf = await agent.get('/api/resumes/res_demo_1/download').expect(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')

    expect((await agent.get('/api/analyses').expect(200)).body.data).toHaveLength(3)
    expect((await agent.get('/api/interviews').expect(200)).body.data.length).toBeGreaterThan(0)
    const dash = await agent.get('/api/dashboard').expect(200)
    expect(dash.body.data).toBeTruthy()
  })

  it('stays read-only and never runs AI for the demo', async () => {
    const agent = await demoAgent()
    // No pre-generated result for this job/resume → read-only, not an AI call.
    const res = await agent.post('/api/resumes/res_demo_2/ai-analysis').expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
    await agent.post('/api/jobs/job_demo_2/tailoring/ai').expect(403)
    expect(await t.db.aiRequest.count()).toBe(0)
    await agent.post('/api/jobs/job_demo_1/status').send({ status: 'offer' }).expect(403)
  })

  it('reuses a fresh seed and reseeds when stale', async () => {
    await demoAgent()
    const first = await t.db.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } })
    await demoAgent()
    const same = await t.db.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } })
    expect(same.demoSeededAt).toEqual(first.demoSeededAt)

    // Yesterday's seed (or an older seed version) is replaced, old sessions included.
    await t.db.user.update({
      where: { id: DEMO_USER_ID },
      data: { demoSeededAt: new Date(Date.now() - 2 * 86_400_000) },
    })
    await t.db.job.deleteMany({ where: { userId: DEMO_USER_ID } })
    await demoAgent()
    expect(await t.db.job.count({ where: { userId: DEMO_USER_ID } })).toBe(
      buildDemoData().jobs.length,
    )
    expect(await t.db.user.count({ where: { isDemo: true } })).toBe(1)
  })

  it('serializes concurrent first visits', async () => {
    await Promise.all([demoAgent(), demoAgent(), demoAgent()])
    expect(await t.db.user.count({ where: { isDemo: true } })).toBe(1)
  })
})
