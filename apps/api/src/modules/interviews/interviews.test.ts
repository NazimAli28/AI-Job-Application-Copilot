import { interviewSessionSchema, type InterviewSession } from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const req = (id: string, skill: string) => ({
  id,
  kind: 'required',
  category: 'skill',
  text: skill,
  skill,
})
const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description: 'We are hiring a Frontend Engineer. Requirements: React, TypeScript, PostgreSQL.',
  responsibilities: ['Build UI'],
  requirements: [req('r1', 'React'), req('r2', 'TypeScript'), req('r3', 'PostgreSQL')],
}
const ANSWER =
  'At Acme I led the migration of our dashboard to React. The situation was slow page loads; I profiled the app, split bundles and added memoization. As a result load time dropped by 40% and support tickets fell.'
const extra = {
  id: 'iq_ai_1',
  type: 'candidate',
  question: 'Tell me about your time at Acme.',
  why: 'Context',
  answerStructure: 'STAR',
  hints: ['Acme dashboard'],
}

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}
type Agent = Awaited<ReturnType<typeof signedIn>>
const createJob = async (a: Agent) =>
  (await a.post('/api/jobs').send(posting).expect(201)).body.data as { id: string }
const start = async (a: Agent, body: Record<string, unknown>) =>
  interviewSessionSchema.parse((await a.post('/api/interviews').send(body).expect(201)).body.data)

describe('sessions', () => {
  it('creates practice (all), mock (mixed ≤ 6) and picked sessions incl. client AI questions', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const all = (await a.get(`/api/jobs/${job.id}/interview-questions`).expect(200)).body.data as {
      id: string
    }[]

    const practice = await start(a, { jobId: job.id, mode: 'practice' })
    expect(practice).toMatchObject({
      jobTitle: 'Frontend Engineer',
      company: 'Acme',
      status: 'in_progress',
    })
    expect(practice.questions.map((q) => q.id)).toEqual(all.map((q) => q.id))
    expect(practice.answers).toEqual([])

    const mock = await start(a, { jobId: job.id, mode: 'mock' })
    expect(mock.questions.length).toBeLessThanOrEqual(6)
    expect(new Set(mock.questions.map((q) => q.type)).size).toBeGreaterThan(1)

    const picked = await start(a, {
      jobId: job.id,
      mode: 'practice',
      questionIds: [all[0]!.id, extra.id],
      extraQuestions: [extra],
    })
    expect(picked.questions.map((q) => q.id)).toEqual([all[0]!.id, extra.id])

    const list = (await a.get('/api/interviews').expect(200)).body.data as InterviewSession[]
    expect(list.map((s) => s.id)).toEqual([picked.id, mock.id, practice.id])
    expect((await a.get(`/api/interviews/${practice.id}`).expect(200)).body.data).toEqual(practice)
  })

  it('validates input, scopes by user and cascades with the job', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    await a.post('/api/interviews').send({ jobId: job.id, mode: 'exam' }).expect(400)
    const none = await a
      .post('/api/interviews')
      .send({ jobId: job.id, mode: 'practice', questionIds: ['nope'] })
      .expect(400)
    expect(none.body.error.message).toMatch(/No interview questions/)
    const s = await start(a, { jobId: job.id, mode: 'practice' })

    const b = await signedIn(bob)
    await b.post('/api/interviews').send({ jobId: job.id, mode: 'practice' }).expect(404)
    await b.get(`/api/interviews/${s.id}`).expect(404)
    await b
      .post(`/api/interviews/${s.id}/answers`)
      .send({ questionId: s.questions[0]!.id, answer: ANSWER })
      .expect(404)
    await b.post(`/api/interviews/${s.id}/complete`).expect(404)
    await b.delete(`/api/interviews/${s.id}`).expect(404)
    expect((await b.get('/api/interviews').expect(200)).body.data).toEqual([])

    await a.delete(`/api/jobs/${job.id}`).expect(200)
    await a.get(`/api/interviews/${s.id}`).expect(404)
  })

  it('completes and deletes a session', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const s = await start(a, { jobId: job.id, mode: 'mock' })
    const done = interviewSessionSchema.parse(
      (await a.post(`/api/interviews/${s.id}/complete`).expect(200)).body.data,
    )
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeTruthy()
    await a.delete(`/api/interviews/${s.id}`).expect(200)
    await a.get(`/api/interviews/${s.id}`).expect(404)
  })
})

describe('answers', () => {
  it('evaluates with rules, replaces re-answers and keeps parallel answers', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const s = await start(a, { jobId: job.id, mode: 'practice' })
    const [q1, q2, q3] = s.questions
    const url = `/api/interviews/${s.id}/answers`

    const first = interviewSessionSchema.parse(
      (await a.post(url).send({ questionId: q1!.id, answer: 'Short.' }).expect(200)).body.data,
    )
    expect(first.answers[0]!.evaluation?.source).toBe('rules')
    const re = interviewSessionSchema.parse(
      (await a.post(url).send({ questionId: q1!.id, answer: ANSWER }).expect(200)).body.data,
    )
    expect(re.answers).toHaveLength(1)
    expect(re.answers[0]!.answer).toBe(ANSWER)

    await Promise.all([
      a.post(url).send({ questionId: q2!.id, answer: ANSWER }).expect(200),
      a.post(url).send({ questionId: q3!.id, answer: ANSWER }).expect(200),
    ])
    const after = (await a.get(`/api/interviews/${s.id}`).expect(200)).body.data as InterviewSession
    expect(after.answers.map((x) => x.questionId).sort()).toEqual([q1!.id, q2!.id, q3!.id].sort())

    await a.post(url).send({ questionId: 'nope', answer: ANSWER }).expect(400)
    await a.post(url).send({ questionId: q1!.id, answer: '  ' }).expect(400)
  })

  it('gates ?ai=1 behind AI access and blocks the demo account', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const s = await start(a, { jobId: job.id, mode: 'practice' })
    const body = { questionId: s.questions[0]!.id, answer: ANSWER }
    const denied = await a.post(`/api/interviews/${s.id}/answers?ai=1`).send(body).expect(403)
    expect(denied.body.error.code).toBe('AI_ACCESS_REQUIRED')
    await t.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })
    const ai = interviewSessionSchema.parse(
      (await a.post(`/api/interviews/${s.id}/answers?ai=1`).send(body).expect(200)).body.data,
    )
    expect(ai.answers[0]!.evaluation?.source).toBe('ai')

    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    const res = await d
      .post('/api/interviews')
      .send({ jobId: job.id, mode: 'practice' })
      .expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
  })
})
