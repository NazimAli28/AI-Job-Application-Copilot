import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../config'
import { AI_TEST_ENV, fakeAi } from '../test/ai'
import { alice, resetDb, testApp } from '../test/helpers'
import { AiHttpError } from './provider'

const claude = fakeAi()
const free = fakeAi()
const env = { ...AI_TEST_ENV, AI_API_KEY: 'gsk_abcdefghijklmnopqrstuvwxyz' }
const t = testApp(env, { aiProvider: claude.provider, aiBackup: free.provider })
afterAll(() => t.db.$disconnect())
beforeEach(async () => {
  await resetDb(t.db)
  claude.calls.length = 0
  free.calls.length = 0
  expect(claude.pending() + free.pending()).toBe(0)
})

const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description: 'We are hiring a Frontend Engineer. Requirements: React, TypeScript, Kubernetes.',
  responsibilities: [],
  requirements: [],
}
const fixture = { explanation: 'Solid React background.', recommendations: [] }

async function proJob() {
  const a = t.request()
  await a.post('/api/auth/register').send(alice).expect(201)
  await t.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })
  const job = (await a.post('/api/jobs').send(posting).expect(201)).body.data
  return { a, url: `/api/jobs/${job.id}/match/ai` }
}
const models = async () =>
  (await t.db.aiRequest.findMany({ orderBy: { createdAt: 'asc' } })).map((r) => [r.model, r.status])

describe('backup mode (Claude → free endpoint)', () => {
  it('config: backup only when both keys are real and AI_BACKUP is on', () => {
    const ai = (e: Record<string, string>) =>
      loadConfig({ DATABASE_URL: 'x', SESSION_SECRET: 'x'.repeat(32), ...e }).ai
    expect(ai(env).backup).toEqual({
      provider: 'openai',
      extractModel: 'llama-3.1-8b-instant',
      generateModel: 'llama-3.3-70b-versatile',
    })
    expect(ai({ ...env, AI_BACKUP: 'off' }).backup).toBeNull()
    expect(ai(AI_TEST_ENV).backup).toBeNull()
    // Claude models are configured separately from the free endpoint's models.
    const both = ai({
      ...env,
      AI_MODEL_GENERATE: 'gemini-2.5-flash',
      CLAUDE_MODEL_EXTRACT: 'claude-haiku-5-5',
    })
    expect(both).toMatchObject({
      extractModel: 'claude-haiku-5-5',
      generateModel: 'claude-sonnet-5-5',
    })
    expect(both.backup?.generateModel).toBe('gemini-2.5-flash')
  })

  it('uses Claude when it works and reports the backup in /ai/usage', async () => {
    const { a, url } = await proJob()
    claude.reply(fixture)
    await a.post(url).expect(200)
    expect(free.calls).toHaveLength(0)
    expect((await a.get('/api/ai/usage')).body.data).toMatchObject({
      provider: 'anthropic',
      backup: 'openai',
    })
  })

  it('falls back to the free endpoint when Claude errors or gives unusable output', async () => {
    const { a, url } = await proJob()
    claude.fail(new AiHttpError(529, 'overloaded'))
    free.reply(fixture)
    expect((await a.post(url).expect(200)).body.data.source).toBe('ai')
    expect(await models()).toEqual([
      ['claude-sonnet-5-5', 'error'],
      ['llama-3.3-70b-versatile', 'ok'],
    ])

    claude.reply(null)
    claude.reply(null)
    free.fail(new AiHttpError(503, 'down'))
    const res = await a.post(url).expect(502) // both engines failed
    expect(res.body.error.code).toBe('AI_UNAVAILABLE')
  })

  it('skips Claude once the monthly budget is spent (free tokens do not count)', async () => {
    const { a, url } = await proJob()
    await t.db.aiRequest.create({
      data: { task: 'x', model: 'llama-3.3-70b-versatile', status: 'ok', inputTokens: 5_000_000 },
    })
    claude.reply(fixture)
    await a.post(url).expect(200)
    expect(free.calls).toHaveLength(0)

    await t.db.aiRequest.create({
      data: { task: 'x', model: 'claude-sonnet-5-5', status: 'ok', inputTokens: 5_000_000 },
    })
    free.reply(fixture)
    await a.post(url).expect(200)
    expect(claude.calls).toHaveLength(1)
    expect(free.calls).toHaveLength(1)
  })

  it('never routes a refusal to the backup', async () => {
    const { a, url } = await proJob()
    claude.reply(null, { stopReason: 'refusal' })
    await a.post(url).expect(422)
    expect(free.calls).toHaveLength(0)
  })
})
