import {
  coverLetterSchema,
  interviewQuestionSchema,
  jobSchema,
  matchResultSchema,
  type SkillMatch,
  tailoringResultSchema,
} from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'
import { makePdf, sampleResumeLines } from '../../test/pdf'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const req = (id: string, skill: string, kind = 'required') => ({
  id,
  kind,
  category: 'skill',
  text: skill,
  skill,
})
const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description: 'We are hiring a Frontend Engineer. Requirements: React, Kubernetes, PostgreSQL.',
  responsibilities: ['Build UI'],
  requirements: [req('r1', 'React'), req('r2', 'Kubernetes'), req('r3', 'PostgreSQL')],
}
const letterBody = { length: 'short', tone: 'professional', highlightIds: [] }
const pdfFile = { filename: 'cv.pdf', contentType: 'application/pdf' }

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}
type Agent = Awaited<ReturnType<typeof signedIn>>
const grantAi = (email = alice.email) =>
  t.db.user.update({ where: { email }, data: { aiAccess: true } })
const createJob = async (a: Agent, extra: Record<string, unknown> = {}) =>
  jobSchema.parse(
    (
      await a
        .post('/api/jobs')
        .send({ ...posting, ...extra })
        .expect(201)
    ).body.data,
  )
const getMatch = async (a: Agent, id: string) =>
  matchResultSchema.parse((await a.get(`/api/jobs/${id}/match`).expect(200)).body.data)
const skillOf = (m: { skills: SkillMatch[] }, name: string) =>
  m.skills.find((s) => s.skill.toLowerCase() === name.toLowerCase())!
const listedScore = async (a: Agent, id: string) =>
  (await a.get('/api/jobs').expect(200)).body.data.find((j: { id: string }) => j.id === id)
    .matchScore as number | undefined
const uploadResume = (a: Agent) =>
  a.post('/api/resumes').attach('file', makePdf(sampleResumeLines), pdfFile).expect(201)
const addExperience = (a: Agent, bullets: string[]) =>
  a
    .post('/api/profile/experience')
    .send({
      title: 'Dev',
      company: 'Beta',
      startDate: '2022-01',
      current: true,
      bullets,
      technologies: [],
    })
    .expect(201)

describe('match', () => {
  it('returns a rules match, 409 without a description, and feeds the list matchScore', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    expect(await listedScore(a, job.id)).toBeUndefined()
    const m = await getMatch(a, job.id)
    expect(m.source).toBe('rules')
    expect(m.jobId).toBe(job.id)
    expect(await listedScore(a, job.id)).toBe(m.score)

    const bare = await createJob(a, { description: '' })
    const res = await a.get(`/api/jobs/${bare.id}/match`).expect(409)
    expect(res.body.error.code).toBe('NEEDS_DESCRIPTION')
  })

  it('reflects profile skills and active-resume evidence', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const before = await getMatch(a, job.id)
    expect(skillOf(before, 'React').status).not.toBe('strong')

    await a
      .post('/api/profile/skills')
      .send({ name: 'React', status: 'confirmed', source: 'manual' })
      .expect(201)
    const withSkill = await getMatch(a, job.id)
    expect(skillOf(withSkill, 'React').status).toBe('strong')
    expect(withSkill.score).toBeGreaterThan(before.score)

    expect(['missing', 'unknown']).toContain(skillOf(withSkill, 'PostgreSQL').status)
    await uploadResume(a)
    const withResume = await getMatch(a, job.id)
    expect(['strong', 'partial']).toContain(skillOf(withResume, 'PostgreSQL').status)
    expect(withResume.score).toBeGreaterThan(withSkill.score)
  })

  it('corrections upsert the profile skill as manual and flag the result corrected', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const url = `/api/jobs/${job.id}/match/corrections`
    const res = await a.post(url).send({ skill: 'Kubernetes', action: 'confirm' }).expect(200)
    const m = matchResultSchema.parse(res.body.data)
    expect(skillOf(m, 'Kubernetes')).toMatchObject({ corrected: true, status: 'strong' })
    let skills = (await a.get('/api/profile')).body.data.skills
    expect(skills).toEqual([
      expect.objectContaining({ name: 'Kubernetes', status: 'confirmed', source: 'manual' }),
    ])

    const rej = await a.post(url).send({ skill: 'kubernetes', action: 'reject' }).expect(200)
    expect(['missing', 'unknown']).toContain(skillOf(rej.body.data, 'Kubernetes').status)
    skills = (await a.get('/api/profile')).body.data.skills
    expect(skills).toHaveLength(1)
    expect(skills[0].status).toBe('rejected')
    expect(skillOf(await getMatch(a, job.id), 'Kubernetes').corrected).toBe(true)
  })

  it('validates corrections and blocks the demo account', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const url = `/api/jobs/${job.id}/match/corrections`
    await a.post(url).send({ skill: '', action: 'confirm' }).expect(400)
    await a
      .post(url)
      .send({ skill: 'x'.repeat(61), action: 'confirm' })
      .expect(400)
    await a.post(url).send({ skill: 'React', action: 'bogus' }).expect(400)

    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    const res = await d
      .post('/api/jobs/any/match/corrections')
      .send({ skill: 'React', action: 'confirm' })
    expect([400, 403]).toContain(res.status)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
  })

  it('gates AI match behind AI access', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const res = await a.post(`/api/jobs/${job.id}/match/ai`).expect(403)
    expect(res.body.error.code).toBe('AI_ACCESS_REQUIRED')
    await grantAi()
    const ok = await a.post(`/api/jobs/${job.id}/match/ai`).expect(200)
    expect(matchResultSchema.parse(ok.body.data).source).toBe('ai')
  })

  it('drops cached matches on posting/resume changes but keeps them for tracking edits', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    await getMatch(a, job.id)
    await a.put(`/api/jobs/${job.id}`).send({ notes: 'Call Sam' }).expect(200)
    expect(await listedScore(a, job.id)).toBeDefined()

    await a
      .put(`/api/jobs/${job.id}`)
      .send({ description: `${posting.description} More.` })
      .expect(200)
    expect(await listedScore(a, job.id)).toBeUndefined()

    await getMatch(a, job.id)
    const resume = (await uploadResume(a)).body.data
    await a
      .put(`/api/jobs/${job.id}`)
      .send({ materials: { resumeId: resume.id, attachments: [] } })
      .expect(200)
    expect(await listedScore(a, job.id)).toBeUndefined()
  })

  it('returns 404 on every route for another user job', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const b = await signedIn(bob)
    await t.db.user.update({ where: { email: bob.email }, data: { aiAccess: true } })
    const id = job.id
    await b.get(`/api/jobs/${id}/match`).expect(404)
    await b.post(`/api/jobs/${id}/match/ai`).expect(404)
    await b
      .post(`/api/jobs/${id}/match/corrections`)
      .send({ skill: 'React', action: 'confirm' })
      .expect(404)
    await b.get(`/api/jobs/${id}/tailoring`).expect(404)
    await b.post(`/api/jobs/${id}/tailoring`).expect(404)
    await b.post(`/api/jobs/${id}/tailoring/ai`).expect(404)
    await b
      .patch(`/api/jobs/${id}/tailoring/suggestions/x`)
      .send({ status: 'accepted' })
      .expect(404)
    await b.get(`/api/jobs/${id}/cover-letters`).expect(404)
    await b.post(`/api/jobs/${id}/cover-letters`).send(letterBody).expect(404)
    await b.get(`/api/jobs/${id}/interview-questions`).expect(404)
    await b.post(`/api/jobs/${id}/interview-questions/ai`).expect(404)
  })
})

describe('tailoring', () => {
  it('is null until generated, then stored per source; suggestions can be accepted and edited', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const base = `/api/jobs/${job.id}/tailoring`
    expect((await a.get(base).expect(200)).body.data).toBeNull()

    await addExperience(a, ['Responsible for the design system used by 5 teams'])
    const gen = await a.post(base).expect(200)
    const result = tailoringResultSchema.parse(gen.body.data)
    expect(result.source).toBe('rules')
    expect(result.bulletSuggestions.length).toBeGreaterThan(0)
    expect(tailoringResultSchema.parse((await a.get(base)).body.data)).toEqual(result)
    expect((await a.get(`${base}?source=ai`).expect(200)).body.data).toBeNull()

    const sid = result.bulletSuggestions[0]!.id
    const acc = await a.patch(`${base}/suggestions/${sid}`).send({ status: 'accepted' }).expect(200)
    expect(acc.body.data.bulletSuggestions[0].status).toBe('accepted')
    const edit = await a
      .patch(`${base}/suggestions/${sid}`)
      .send({ status: 'accepted', suggested: 'Led the design system' })
      .expect(200)
    expect(edit.body.data.bulletSuggestions[0].suggested).toBe('Led the design system')
    const stored = tailoringResultSchema.parse((await a.get(base)).body.data)
    expect(stored.bulletSuggestions[0]).toMatchObject({
      status: 'accepted',
      suggested: 'Led the design system',
    })

    await a.patch(`${base}/suggestions/nope`).send({ status: 'rejected' }).expect(404)
    await a.patch(`${base}/suggestions/${sid}`).send({ status: 'maybe' }).expect(400)
  })

  it('gates AI tailoring behind AI access', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const url = `/api/jobs/${job.id}/tailoring/ai`
    expect((await a.post(url).expect(403)).body.error.code).toBe('AI_ACCESS_REQUIRED')
    await grantAi()
    const ok = await a.post(url).expect(200)
    expect(tailoringResultSchema.parse(ok.body.data).source).toBe('ai')
    const got = await a.get(`/api/jobs/${job.id}/tailoring?source=ai`).expect(200)
    expect(got.body.data.source).toBe('ai')
  })
})

describe('cover letters', () => {
  it('creates, lists newest first, edits and deletes (owner only)', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const url = `/api/jobs/${job.id}/cover-letters`
    const first = coverLetterSchema.parse(
      (await a.post(url).send(letterBody).expect(201)).body.data,
    )
    expect(first).toMatchObject({ jobId: job.id, source: 'rules', length: 'short' })
    const second = coverLetterSchema.parse(
      (
        await a
          .post(url)
          .send({ ...letterBody, tone: 'friendly' })
          .expect(201)
      ).body.data,
    )
    const list = (await a.get(url).expect(200)).body.data
    expect(list.map((l: { id: string }) => l.id)).toEqual([second.id, first.id])

    const put = await a
      .put(`/api/cover-letters/${first.id}`)
      .send({ content: 'My edit' })
      .expect(200)
    expect(put.body.data.content).toBe('My edit')
    await a.put(`/api/cover-letters/${first.id}`).send({ content: '' }).expect(400)

    const b = await signedIn(bob)
    await b.put(`/api/cover-letters/${first.id}`).send({ content: 'hax' }).expect(404)
    await b.delete(`/api/cover-letters/${first.id}`).expect(404)

    await a.delete(`/api/cover-letters/${first.id}`).expect(200)
    await a.delete(`/api/cover-letters/${first.id}`).expect(404)
    expect((await a.get(url)).body.data).toHaveLength(1)
  })

  it('gates useAi behind AI access', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const url = `/api/jobs/${job.id}/cover-letters`
    const res = await a
      .post(url)
      .send({ ...letterBody, useAi: true })
      .expect(403)
    expect(res.body.error.code).toBe('AI_ACCESS_REQUIRED')
    await grantAi()
    const ok = await a
      .post(url)
      .send({ ...letterBody, useAi: true })
      .expect(201)
    expect(coverLetterSchema.parse(ok.body.data).source).toBe('ai')
  })

  it('links a job to its own letter only, and unlinks when the letter is deleted', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const other = await createJob(a, { title: 'Other' })
    const mine = (await a.post(`/api/jobs/${job.id}/cover-letters`).send(letterBody).expect(201))
      .body.data
    const foreign = (
      await a.post(`/api/jobs/${other.id}/cover-letters`).send(letterBody).expect(201)
    ).body.data

    const link = (id: string) =>
      a.put(`/api/jobs/${job.id}`).send({ materials: { coverLetterId: id, attachments: [] } })
    await link('bogus').expect(400)
    await link(foreign.id).expect(400)
    const ok = await link(mine.id).expect(200)
    expect(ok.body.data.materials.coverLetterId).toBe(mine.id)

    await a.delete(`/api/cover-letters/${mine.id}`).expect(200)
    const after = jobSchema.parse((await a.get(`/api/jobs/${job.id}`)).body.data)
    expect(after.materials.coverLetterId).toBeUndefined()

    await a
      .post('/api/jobs')
      .send({ ...posting, materials: { coverLetterId: foreign.id } })
      .expect(400)
  })

  it('cascades letters and cached results when the job is deleted', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    await a.post(`/api/jobs/${job.id}/cover-letters`).send(letterBody).expect(201)
    await getMatch(a, job.id)
    await a.post(`/api/jobs/${job.id}/tailoring`).expect(200)
    await a.delete(`/api/jobs/${job.id}`).expect(200)
    expect(await t.db.coverLetter.count()).toBe(0)
    expect(await t.db.jobMatch.count()).toBe(0)
    expect(await t.db.jobTailoring.count()).toBe(0)
  })
})

describe('interview questions', () => {
  it('returns valid questions and gates the AI variant', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const res = await a.get(`/api/jobs/${job.id}/interview-questions`).expect(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    for (const q of res.body.data) interviewQuestionSchema.parse(q)

    const url = `/api/jobs/${job.id}/interview-questions/ai`
    expect((await a.post(url).expect(403)).body.error.code).toBe('AI_ACCESS_REQUIRED')
    await grantAi()
    const ok = await a.post(url).expect(200)
    expect(Array.isArray(ok.body.data)).toBe(true)
    for (const q of ok.body.data) interviewQuestionSchema.parse(q)
  })
})
