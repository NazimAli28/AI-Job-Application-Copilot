import {
  answerEvaluationSchema,
  coverLetterSchema,
  interviewQuestionSchema,
  jobSchema,
  matchResultSchema,
  tailoringResultSchema,
} from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../config'
import { makePdf, sampleResumeLines } from '../test/pdf'
import { AI_TEST_ENV, fakeAi } from '../test/ai'
import { alice, resetDb, testApp } from '../test/helpers'
import { AiHttpError } from './provider'

const ai = fakeAi()
const t = testApp({ ...AI_TEST_ENV, AI_DAILY_LIMIT: '6' }, { aiProvider: ai.provider })
afterAll(() => t.db.$disconnect())
beforeEach(async () => {
  await resetDb(t.db)
  ai.calls.length = 0
  expect(ai.pending()).toBe(0) // every queued fixture was consumed by the previous test
})

const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description:
    'We are hiring a Frontend Engineer with 3+ years of experience. Requirements: React, TypeScript, Kubernetes.',
  responsibilities: ['Build UI'],
  requirements: [
    { id: 'r1', kind: 'required', category: 'skill', text: 'React', skill: 'React' },
    { id: 'r2', kind: 'required', category: 'skill', text: 'Kubernetes', skill: 'Kubernetes' },
  ],
}

async function proUser() {
  const a = t.request()
  await a.post('/api/auth/register').send(alice).expect(201)
  await t.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })
  await a
    .put('/api/profile')
    .send({
      fullName: alice.name,
      email: alice.email,
      phone: '+1 555 0100',
      targetTitles: ['Frontend Engineer'],
      yearsExperience: 3,
      workTypes: ['remote'],
      preferredLocations: [],
      salaryCurrency: 'USD',
    })
    .expect(200)
  await a
    .post('/api/profile/experience')
    .send({
      title: 'Developer',
      company: 'Beta',
      startDate: '2021-01',
      current: true,
      bullets: ['Built React dashboards for 3 teams', 'Fixed bugs'],
      technologies: ['React'],
    })
    .expect(201)
  const job = jobSchema.parse((await a.post('/api/jobs').send(posting).expect(201)).body.data)
  return { a, job }
}
const logs = () => t.db.aiRequest.findMany({ orderBy: { createdAt: 'asc' } })

describe('AI Pro service', () => {
  it('match: keeps the computed score, adds the explanation, logs usage (no text stored)', async () => {
    const { a, job } = await proUser()
    const rules = matchResultSchema.parse((await a.get(`/api/jobs/${job.id}/match`)).body.data)
    ai.reply({
      explanation: 'Your React work at Beta is a strong signal. Kubernetes is the main gap.',
      recommendations: ['Deploy a small app on Kubernetes and add it as a project.'],
    })
    const m = matchResultSchema.parse(
      (await a.post(`/api/jobs/${job.id}/match/ai`).expect(200)).body.data,
    )
    expect(m).toMatchObject({ source: 'ai', score: rules.score, skills: rules.skills })
    expect(m.explanation).toContain('Kubernetes is the main gap')
    expect(ai.calls[0]!.model).toBe('claude-sonnet-5-5')
    expect(ai.calls[0]!.system).toContain('Never invent')
    expect(ai.calls[0]!.prompt).toContain('<job_posting>')
    const [row] = await logs()
    expect(row).toMatchObject({
      task: 'match-explain',
      status: 'ok',
      inputTokens: 100,
      outputTokens: 50,
    })
    expect(Object.keys(row!)).not.toContain('prompt')
  })

  it('retries once when a guardrail rejects the output (invented metric), then 502s', async () => {
    const { a, job } = await proUser()
    ai.reply({ explanation: 'You improved conversion by 45%.', recommendations: [] })
    ai.reply({ explanation: 'Solid React background.', recommendations: [] })
    await a.post(`/api/jobs/${job.id}/match/ai`).expect(200)
    expect((await logs()).map((r) => [r.status, r.errorCode])).toEqual([
      ['invalid', 'GUARDRAIL'],
      ['ok', null],
    ])

    ai.reply(null) // schema-invalid
    ai.reply(null, { stopReason: 'max_tokens' })
    const res = await a.post(`/api/jobs/${job.id}/match/ai`).expect(502)
    expect(res.body.error.code).toBe('AI_UNAVAILABLE')
    expect((await logs()).slice(2).map((r) => r.errorCode)).toEqual(['SCHEMA', 'TRUNCATED'])
  })

  it('maps provider failures and refusals to clear errors', async () => {
    const { a, job } = await proUser()
    ai.fail(new AiHttpError(529, 'overloaded'))
    expect((await a.post(`/api/jobs/${job.id}/match/ai`).expect(502)).body.error.code).toBe(
      'AI_UNAVAILABLE',
    )
    ai.reply(null, { stopReason: 'refusal' })
    await a.post(`/api/jobs/${job.id}/match/ai`).expect(422)
    expect((await logs()).map((r) => [r.status, r.errorCode])).toEqual([
      ['error', 'HTTP_529'],
      ['refused', null],
    ])
  })

  it('enforces the daily per-user quota and the global monthly token cap', async () => {
    const { a, job } = await proUser()
    await t.db.aiRequest.createMany({
      data: Array.from({ length: 6 }, () => ({
        task: 'x',
        model: 'm',
        status: 'ok',
        inputTokens: 10,
      })),
    })
    // other users' rows don't count toward alice's daily quota…
    const me = await t.db.user.findUniqueOrThrow({ where: { email: alice.email } })
    ai.reply({ explanation: 'ok', recommendations: [] })
    await a.post(`/api/jobs/${job.id}/match/ai`).expect(200)

    // …hers do
    await t.db.aiRequest.createMany({
      data: Array.from({ length: 5 }, () => ({
        userId: me.id,
        task: 'x',
        model: 'm',
        status: 'ok',
      })),
    })
    const quota = await a.post(`/api/jobs/${job.id}/match/ai`).expect(429)
    expect(quota.body.error).toMatchObject({ code: 'AI_QUOTA_EXCEEDED' })
    expect(quota.body.error.details.resetsAt).toBeTruthy()

    const usage = (await a.get('/api/ai/usage').expect(200)).body.data
    expect(usage).toMatchObject({ provider: 'anthropic', usedToday: 6, dailyLimit: 6 })
    expect(usage).not.toHaveProperty('monthlyTokens') // admins only

    const capped = testApp(
      { ...AI_TEST_ENV, AI_MONTHLY_TOKEN_CAP: '100' },
      { aiProvider: ai.provider },
    )
    const b = capped.request()
    await b.post('/api/auth/login').send(alice).expect(200)
    const res = await b.post(`/api/jobs/${job.id}/match/ai`).expect(503)
    expect(res.body.error.code).toBe('AI_UNAVAILABLE')
    await capped.db.$disconnect()
  })

  it('tailoring: drops unknown refs and bullets with invented numbers', async () => {
    const { a, job } = await proUser()
    ai.reply({
      summary: 'React developer at Beta applying for the Frontend Engineer role at Acme.',
      bullets: [
        {
          ref: 'e0b0',
          suggested: 'Built React dashboards used by 3 teams',
          reason: 'Matches React.',
        },
        { ref: 'e0b1', suggested: 'Fixed 120 bugs', reason: 'Shows impact.' },
        { ref: 'e9b9', suggested: 'Made up', reason: 'x' },
      ],
    })
    const tr = tailoringResultSchema.parse(
      (await a.post(`/api/jobs/${job.id}/tailoring/ai`).expect(200)).body.data,
    )
    expect(tr.source).toBe('ai')
    expect(tr.bulletSuggestions.map((b) => [b.original, b.suggested])).toEqual([
      ['Built React dashboards for 3 teams', 'Built React dashboards used by 3 teams'],
    ])
    expect(ai.calls[0]!.prompt).not.toContain(alice.email) // no contact details sent
    expect(ai.calls[0]!.prompt).not.toContain('555')
    const stored = (await a.get(`/api/jobs/${job.id}/tailoring?source=ai`).expect(200)).body.data
    expect(stored.summary).toContain('Frontend Engineer')
  })

  it('cover letter + job parse + questions + answer evaluation', async () => {
    const { a, job } = await proUser()
    ai.reply({
      content: `Dear Hiring Manager,\n\nI am excited to apply for the Frontend Engineer role at Acme. At Beta I built React dashboards for 3 teams, and I want to bring that focus on usable interfaces to your product.\n\nThank you for your consideration.\n\nSincerely,\n[Your name]`,
    })
    const letter = coverLetterSchema.parse(
      (
        await a
          .post(`/api/jobs/${job.id}/cover-letters`)
          .send({ length: 'short', tone: 'professional', highlightIds: [], useAi: true })
          .expect(201)
      ).body.data,
    )
    expect(letter.source).toBe('ai')
    expect(letter.content).toContain(`Sincerely,\n${alice.name}`)
    expect(ai.calls[0]!.prompt).not.toContain(alice.name)

    ai.reply({
      title: 'Frontend Engineer',
      company: 'Acme',
      experienceYearsMin: 3,
      responsibilities: ['Build UI'],
      requirements: [
        { kind: 'required', category: 'skill', text: 'React', skill: 'React' },
        { kind: 'required', category: 'skill', text: 'Rust', skill: 'Rust' }, // not in the text
        { kind: 'required', category: 'experience', text: '3+ years of experience' },
      ],
    })
    const parsed = (
      await a.post('/api/jobs/parse-ai').send({ description: posting.description }).expect(200)
    ).body.data
    expect(ai.calls[1]!.model).toBe('claude-haiku-4-5')
    const skills = parsed.requirements
      .filter((r: { skill?: string }) => r.skill)
      .map((r: { skill: string }) => r.skill)
    expect(skills).toContain('React')
    expect(skills).toContain('Kubernetes') // rules skill kept
    expect(skills).not.toContain('Rust')
    expect(parsed.experienceYearsMin).toBe(3)

    ai.reply({
      questions: [
        {
          question: 'How did you decide what the React dashboards at Beta should show?',
          why: 'Tests product thinking.',
          answerStructure: 'STAR',
          hints: ['Your dashboards for 3 teams'],
          difficulty: 'medium',
        },
      ],
    })
    const qs = (await a.post(`/api/jobs/${job.id}/interview-questions/ai`).expect(200)).body.data
    expect(interviewQuestionSchema.array().parse(qs)[0]).toMatchObject({ type: 'candidate' })

    const session = (
      await a.post('/api/interviews').send({ jobId: job.id, mode: 'practice' }).expect(201)
    ).body.data
    const q = session.questions[0]
    ai.reply({
      score: 140,
      criteria: {
        relevance: 9,
        clarity: 4,
        technicalAccuracy: 3,
        structure: 4,
        examples: 0,
        conciseness: 4,
      },
      strengths: ['Concrete example'],
      weaknesses: [],
      suggestions: ['Add the outcome'],
    })
    const answer =
      'At Beta I led the dashboard rebuild in React, interviewing users first, then shipping weekly iterations. The result was a clearer workflow and fewer support questions from the three teams using it every day.'
    const done = (
      await a
        .post(`/api/interviews/${session.id}/answers?ai=1`)
        .send({ questionId: q.id, answer })
        .expect(200)
    ).body.data
    const ev = answerEvaluationSchema.parse(done.answers[0].evaluation)
    expect(ev).toMatchObject({ source: 'ai', score: 100 })
    expect(ev.criteria).toMatchObject({ relevance: 5, examples: 1 })
  })

  it('resume analysis: rewrites flagged lines unless they invent numbers', async () => {
    const { a } = await proUser()
    const up = await a
      .post('/api/resumes')
      .attach('file', makePdf(sampleResumeLines), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)
    const resume = up.body.data
    const flagged = resume.analysis.issues.filter((i: { original?: string }) => i.original)
    expect(flagged.length).toBeGreaterThan(0)
    const [first, second] = flagged
    ai.reply({
      rewrites: [
        { issueId: first.id, suggestion: `Delivered: ${first.original} [add metric]` },
        ...(second ? [{ issueId: second.id, suggestion: 'Boosted revenue 900%' }] : []),
      ],
      recommendations: ['Move your strongest project above education.'],
    })
    const res = (await a.post(`/api/resumes/${resume.id}/ai-analysis`).expect(200)).body.data
    expect(res.source).toBe('ai')
    expect(res.score ?? res.overallScore).toBe(resume.analysis.overallScore)
    const byId = new Map(
      res.issues.map((i: { id: string; suggestion?: string }) => [i.id, i.suggestion]),
    )
    expect(byId.get(`ai_${first.id}`)).toContain('[add metric]')
    if (second) expect(byId.get(`ai_${second.id}`)).not.toContain('900')
    expect(res.recommendations).toEqual(['Move your strongest project above education.'])
    expect(ai.calls[0]!.prompt).toContain('<resume>')
  })

  it('analytics insights skip the AI call below 5 applications', async () => {
    const { a } = await proUser()
    const res = (await a.post('/api/analytics/ai-insights').expect(200)).body.data
    expect(res.insights).toEqual([])
    expect(res.message).toContain('Not enough data')
    expect(ai.calls).toHaveLength(0)
  })
})

describe('simulated engine (no real key)', () => {
  it('serves AI Pro without calls and still counts toward the daily quota', async () => {
    const sim = testApp({ AI_DAILY_LIMIT: '1' })
    expect(sim.config.ai.provider).toBe('simulated')
    const a = sim.request()
    await a.post('/api/auth/register').send(alice).expect(201)
    await sim.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })
    const job = (await a.post('/api/jobs').send(posting).expect(201)).body.data
    const m = (await a.post(`/api/jobs/${job.id}/match/ai`).expect(200)).body.data
    expect(m.source).toBe('ai')
    expect(await sim.db.aiRequest.findFirst()).toMatchObject({ model: 'simulated', status: 'ok' })
    await a.post(`/api/jobs/${job.id}/match/ai`).expect(429)
    expect((await a.get('/api/ai/usage')).body.data.provider).toBe('simulated')
    await sim.db.$disconnect()
  })

  it('resolves the provider from keys: placeholder → simulated, generic key → openai', async () => {
    const ai = (env: Record<string, string>) =>
      loadConfig({ DATABASE_URL: 'x', SESSION_SECRET: 'x'.repeat(32), ...env }).ai
    expect(ai({ ANTHROPIC_API_KEY: 'sk-ant-your-key-here' }).provider).toBe('simulated')
    expect(ai({ ...AI_TEST_ENV, AI_API_KEY: 'gsk_abcdefghijklmnopqrstuvwxyz' }).provider).toBe(
      'anthropic',
    )
    const generic = ai({ AI_API_KEY: 'gsk_abcdefghijklmnopqrstuvwxyz' })
    expect(generic).toMatchObject({
      provider: 'openai',
      extractModel: 'llama-3.1-8b-instant',
      generateModel: 'llama-3.3-70b-versatile',
    })
    expect(ai({ AI_API_KEY: 'your-free-tier-key-here' }).provider).toBe('simulated')
    expect(
      ai({ AI_PROVIDER: 'openai', AI_API_KEY: 'ollama', AI_MODEL_GENERATE: 'llama3.1' }),
    ).toMatchObject({
      provider: 'openai',
      generateModel: 'llama3.1',
    })
  })
})
