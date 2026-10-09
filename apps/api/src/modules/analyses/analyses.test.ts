import {
  analysisSchema,
  jobSchema,
  matchResultSchema,
  tailoringResultSchema,
} from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { HttpFetch } from '../../lib/safe-fetch'
import { alice, resetDb, testApp } from '../../test/helpers'
import { makePdf, sampleResumeLines } from '../../test/pdf'

/** Fake outbound fetch: canned responses by URL (no network in tests). */
const pages: Record<string, string> = {}
const fakeFetch: HttpFetch = async (url) => {
  const body = pages[url]
  if (body === undefined) throw new Error('offline')
  return { status: 200, url, contentType: 'text/html', body }
}

const t = testApp({}, { httpFetch: fakeFetch })
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const JD = `Frontend Engineer
Acme is hiring a Frontend Engineer.
Requirements
- 2+ years of experience with React and TypeScript
- Experience with Kubernetes
Nice to have
- GraphQL`
const pdfFile = { filename: 'cv.pdf', contentType: 'application/pdf' }

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}
type Agent = Awaited<ReturnType<typeof signedIn>>
const uploadResume = async (a: Agent) =>
  (await a.post('/api/resumes').attach('file', makePdf(sampleResumeLines), pdfFile).expect(201))
    .body.data as { id: string }
const run = async (
  a: Agent,
  resumeId: string,
  body: Record<string, unknown> = { description: JD },
) =>
  analysisSchema.parse(
    (
      await a
        .post('/api/analyses')
        .send({ resumeId, ...body })
        .expect(200)
    ).body.data,
  )
const grantAi = () => t.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })

describe('run + read', () => {
  it('builds the full result from resume + description and lists it as a recent check', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const an = await run(a, resumeId)
    expect(an.resumeId).toBe(resumeId)
    expect(an.resumeLabel).toBe('cv.pdf')
    expect(an.job.title).toBe('Frontend Engineer')
    expect(an.match.skills.find((s) => s.skill === 'React')?.status).toBe('strong') // resume evidence
    expect(an.questions.length).toBeGreaterThan(0)
    expect(an.tailoring.keywords.length).toBeGreaterThan(0)

    expect((await a.get(`/api/analyses/${an.id}`).expect(200)).body.data).toEqual(an)
    const list = (await a.get('/api/analyses').expect(200)).body.data
    expect(list).toEqual([
      {
        id: an.id,
        createdAt: an.createdAt,
        resumeLabel: 'cv.pdf',
        title: 'Frontend Engineer',
        company: an.job.company,
        score: an.match.score,
      },
    ])
  })

  it('validates input and scopes everything by user', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    await a.post('/api/analyses').send({ resumeId, description: 'too short' }).expect(400)
    await a
      .post('/api/analyses')
      .send({ resumeId, url: 'javascript:alert(1)', description: '' })
      .expect(400)
    const an = await run(a, resumeId)

    const b = await signedIn(bob)
    await b.post('/api/analyses').send({ resumeId, description: JD }).expect(404) // alice's resume
    await b.get(`/api/analyses/${an.id}`).expect(404)
    await b.delete(`/api/analyses/${an.id}`).expect(404)
    await b.post(`/api/analyses/${an.id}/save`).send({}).expect(404)
    await b
      .post(`/api/analyses/${an.id}/cover-letter`)
      .send({ length: 'short', tone: 'professional' })
      .expect(404)
    expect((await b.get('/api/analyses').expect(200)).body.data).toEqual([])

    await a.delete(`/api/analyses/${an.id}`).expect(200)
    await a.get(`/api/analyses/${an.id}`).expect(404)
  })

  it('imports a URL server-side and answers 422 when the page has no posting', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Platform Engineer',
      hiringOrganization: { name: 'Globex' },
      description: `<p>${JD.replace(/\n/g, '<br>')}</p>`,
    }
    pages['https://jobs.example.com/1'] =
      `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`
    pages['https://jobs.example.com/empty'] = '<html><body>Nothing here</body></html>'

    const an = await run(a, resumeId, { url: 'https://jobs.example.com/1' })
    expect(an.importedFrom).toBe('jsonld')
    expect(an.job).toMatchObject({
      title: 'Platform Engineer',
      company: 'Globex',
      url: 'https://jobs.example.com/1',
    })

    const res = await a
      .post('/api/analyses')
      .send({ resumeId, url: 'https://jobs.example.com/empty' })
      .expect(422)
    expect(res.body.error.code).toBe('IMPORT_FAILED')
  })

  it('keeps only the 20 newest checks', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const first = await run(a, resumeId)
    for (let i = 0; i < 20; i++) await run(a, resumeId)
    const list = (await a.get('/api/analyses').expect(200)).body.data as { id: string }[]
    expect(list).toHaveLength(20)
    expect(list.some((x) => x.id === first.id)).toBe(false)
    expect(await t.db.analysis.count()).toBe(20)
  })
})

describe('save as job', () => {
  it('creates a tracked job with the same score, idempotently', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const an = await run(a, resumeId)

    const res = await a
      .post(`/api/analyses/${an.id}/save`)
      .send({ status: 'applied', company: 'Acme Corp' })
      .expect(201)
    const job = jobSchema.parse(res.body.data)
    expect(job).toMatchObject({
      title: 'Frontend Engineer',
      company: 'Acme Corp',
      status: 'applied',
    })
    expect(job.materials.resumeId).toBe(resumeId)
    expect(job.appliedAt).toBeTruthy()
    expect(job.history.map((h) => h.status)).toEqual(['applied'])

    const again = await a.post(`/api/analyses/${an.id}/save`).send({}).expect(200)
    expect(again.body.data.id).toBe(job.id)
    expect((await a.get(`/api/analyses/${an.id}`).expect(200)).body.data.savedJobId).toBe(job.id)

    // Server match + rules tailoring were computed at save time.
    const listed = (await a.get('/api/jobs').expect(200)).body.data[0]
    expect(listed.matchScore).toBe(an.match.score)
    const m = matchResultSchema.parse(
      (await a.get(`/api/jobs/${job.id}/match`).expect(200)).body.data,
    )
    expect(m.score).toBe(an.match.score)
    tailoringResultSchema.parse(
      (await a.get(`/api/jobs/${job.id}/tailoring`).expect(200)).body.data,
    )
  })

  it('creates one job under concurrent saves and a new one after the job is deleted', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const an = await run(a, resumeId)
    const results = await Promise.all(
      [0, 1, 2].map(() => a.post(`/api/analyses/${an.id}/save`).send({})),
    )
    const ids = new Set(results.map((r) => r.body.data.id as string))
    expect(ids.size).toBe(1)
    expect(await t.db.job.count()).toBe(1)

    await a.delete(`/api/jobs/${[...ids][0]}`).expect(200)
    expect((await a.get(`/api/analyses/${an.id}`).expect(200)).body.data.savedJobId).toBeUndefined()
    const fresh = await a.post(`/api/analyses/${an.id}/save`).send({}).expect(201)
    expect(ids.has(fresh.body.data.id)).toBe(false)
  })

  it('still saves after the resume was deleted (job has no resume)', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const an = await run(a, resumeId)
    await a.delete(`/api/resumes/${resumeId}`).expect(200)
    const got = analysisSchema.parse((await a.get(`/api/analyses/${an.id}`).expect(200)).body.data)
    expect(got.resumeId).toBe(resumeId) // original reference kept in the result
    const job = (await a.post(`/api/analyses/${an.id}/save`).send({}).expect(201)).body.data
    expect(job.materials.resumeId).toBeUndefined()
  })
})

describe('cover letter, AI and demo', () => {
  it('drafts a rules cover letter and gates the AI analysis', async () => {
    const a = await signedIn()
    const { id: resumeId } = await uploadResume(a)
    const an = await run(a, resumeId)
    const letter = await a
      .post(`/api/analyses/${an.id}/cover-letter`)
      .send({ length: 'short', tone: 'professional' })
      .expect(200)
    expect(letter.body.data.content).toContain('Frontend Engineer')
    await a
      .post(`/api/analyses/${an.id}/cover-letter`)
      .send({ length: 'huge', tone: 'x' })
      .expect(400)

    const denied = await a.post(`/api/analyses/${an.id}/ai`).expect(403)
    expect(denied.body.error.code).toBe('AI_ACCESS_REQUIRED')
    await grantAi()
    const ai = (await a.post(`/api/analyses/${an.id}/ai`).expect(200)).body.data
    expect(matchResultSchema.parse(ai.match).source).toBe('ai')
    expect(tailoringResultSchema.parse(ai.tailoring).source).toBe('ai')
  })

  it('blocks writes for the demo account', async () => {
    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    const before = (await d.get('/api/analyses').expect(200)).body.data
    expect(before).toHaveLength(3) // seeded samples
    const res = await d.post('/api/analyses').send({ resumeId: 'x', description: JD }).expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
    await d.post('/api/analyses/x/save').send({}).expect(403)
    expect((await d.get('/api/analyses').expect(200)).body.data).toEqual(before)
  })
})
