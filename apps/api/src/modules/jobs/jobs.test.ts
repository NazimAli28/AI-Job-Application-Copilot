import { jobSchema } from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { HttpFetch } from '../../lib/safe-fetch'
import { alice, resetDb, testApp } from '../../test/helpers'

/** Fake outbound fetch: canned responses by URL (no network in tests). */
const pages: Record<string, { status?: number; contentType?: string; body: string }> = {}
const fakeFetch: HttpFetch = async (url) => {
  const p = pages[url]
  if (!p) throw new Error('offline')
  return { status: p.status ?? 200, url, contentType: p.contentType ?? 'text/html', body: p.body }
}

const t = testApp({}, { httpFetch: fakeFetch })
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const DESC =
  'We are hiring a Frontend Engineer. Requirements: 3+ years of React and TypeScript. Nice to have: GraphQL.'
const posting = {
  title: 'Frontend Engineer',
  company: 'Acme',
  description: DESC,
  responsibilities: ['Build UI'],
  requirements: [{ id: 'r1', kind: 'required', category: 'skill', text: 'React', skill: 'React' }],
}

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}
type Agent = Awaited<ReturnType<typeof signedIn>>
const createJob = async (a: Agent, extra: Record<string, unknown> = {}) =>
  jobSchema.parse(
    (
      await a
        .post('/api/jobs')
        .send({ ...posting, ...extra })
        .expect(201)
    ).body.data,
  )

describe('jobs CRUD', () => {
  it('creates with tracking defaults, lists newest first, reads, updates and deletes', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    expect(job).toMatchObject({ status: 'saved', archived: false, tags: [], contacts: [] })
    expect(job.history).toEqual([{ status: 'saved', at: expect.any(String) }])
    expect(job.materials).toEqual({ attachments: [] })
    expect(job.appliedAt).toBeUndefined()

    const linkOnly = await createJob(a, { title: 'Link only', description: '', status: 'applied' })
    expect(linkOnly.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const list = (await a.get('/api/jobs').expect(200)).body.data
    expect(list.map((j: { title: string }) => j.title)).toEqual(['Link only', 'Frontend Engineer'])
    expect(list[0].needsDescription).toBe(true)
    expect(list[1].needsDescription).toBe(false)

    const put = await a
      .put(`/api/jobs/${job.id}`)
      .send({ notes: 'Call Sam', tags: ['remote'], salary: '100k' })
      .expect(200)
    expect(put.body.data).toMatchObject({
      notes: 'Call Sam',
      tags: ['remote'],
      title: posting.title,
    })
    expect((await a.get(`/api/jobs/${job.id}`)).body.data.salary).toBe('100k')

    await a.delete(`/api/jobs/${job.id}`).expect(200)
    await a.get(`/api/jobs/${job.id}`).expect(404)
  })

  it('validates input (required fields, http(s)-only links)', async () => {
    const a = await signedIn()
    await a
      .post('/api/jobs')
      .send({ ...posting, title: '' })
      .expect(400)
    await a
      .post('/api/jobs')
      .send({ ...posting, url: 'javascript:alert(1)' })
      .expect(400)
    const job = await createJob(a)
    await a.put(`/api/jobs/${job.id}`).send({ status: 'nope' }).expect(400)
    const bad = await a
      .put(`/api/jobs/${job.id}`)
      .send({ contacts: [{ id: 'c1', name: 'Sam', linkedinUrl: 'data:text/html,x' }] })
      .expect(400)
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('archives (toggle) and hides archived jobs unless ?archived=1', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    expect((await a.post(`/api/jobs/${job.id}/archive`).expect(200)).body.data.archived).toBe(true)
    expect((await a.get('/api/jobs')).body.data).toHaveLength(0)
    expect((await a.get('/api/jobs?archived=1')).body.data).toHaveLength(1)
    expect((await a.post(`/api/jobs/${job.id}/archive`)).body.data.archived).toBe(false)
  })

  it("isolates users: another user's job is a 404 everywhere; demo is read-only", async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const b = await signedIn(bob)
    expect((await b.get('/api/jobs')).body.data).toEqual([])
    await b.get(`/api/jobs/${job.id}`).expect(404)
    await b.put(`/api/jobs/${job.id}`).send({ notes: 'x' }).expect(404)
    await b.post(`/api/jobs/${job.id}/status`).send({ status: 'applied' }).expect(404)
    await b.post(`/api/jobs/${job.id}/archive`).expect(404)
    await b
      .post(`/api/jobs/${job.id}/attachments`)
      .send({ label: 'x', url: 'https://x.io' })
      .expect(404)
    await b.delete(`/api/jobs/${job.id}`).expect(404)
    await t.request().get('/api/jobs').expect(401)

    const demo = t.request()
    await demo.post('/api/auth/demo').expect(200)
    const res = await demo.post('/api/jobs').send(posting).expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
  })
})

describe('tracking', () => {
  it('status changes append history and fill appliedAt once', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    const applied = (
      await a
        .post(`/api/jobs/${job.id}/status`)
        .send({ status: 'applied', note: 'Sent' })
        .expect(200)
    ).body.data
    expect(applied.history.map((h: { status: string }) => h.status)).toEqual(['saved', 'applied'])
    expect(applied.history[1].note).toBe('Sent')
    expect(applied.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await a.put(`/api/jobs/${job.id}`).send({ appliedAt: '2026-01-02' }).expect(200)
    const screening = (await a.put(`/api/jobs/${job.id}`).send({ status: 'screening' }).expect(200))
      .body.data
    expect(screening.appliedAt).toBe('2026-01-02')
    expect(screening.history).toHaveLength(3)
    // Same status again: no new history entry.
    const same = (await a.post(`/api/jobs/${job.id}/status`).send({ status: 'screening' })).body
      .data
    expect(same.history).toHaveLength(3)
  })

  it('materials: own resume only, attachments are server-owned', async () => {
    const a = await signedIn()
    const job = await createJob(a)
    await a
      .put(`/api/jobs/${job.id}`)
      .send({ materials: { resumeId: 'someone-elses', attachments: [] } })
      .expect(400)
    await a
      .post(`/api/jobs/${job.id}/attachments`)
      .send({ label: 'Portfolio', url: 'https://me.dev' })
      .expect(201)
    const forged = {
      id: 'att_x',
      kind: 'link',
      label: 'Forged',
      url: 'https://evil.dev',
      addedAt: new Date().toISOString(),
    }
    const res = await a
      .put(`/api/jobs/${job.id}`)
      .send({ materials: { coverLetterText: 'Dear Acme', attachments: [forged] } })
      .expect(200)
    expect(res.body.data.materials.coverLetterText).toBe('Dear Acme')
    expect(res.body.data.materials.attachments.map((x: { label: string }) => x.label)).toEqual([
      'Portfolio',
    ])
  })
})

describe('attachments', () => {
  it('uploads, downloads and deletes files; deleting the job removes stored files', async () => {
    const a = await signedIn()
    const me = (await a.get('/api/auth/me')).body.data
    const job = await createJob(a)
    const bytes = Buffer.from('%PDF-1.4 portfolio')
    const up = await a
      .post(`/api/jobs/${job.id}/attachments`)
      .field('label', 'Portfolio')
      .attach('file', bytes, { filename: 'portfolio.pdf', contentType: 'text/html' })
      .expect(201)
    const att = up.body.data.materials.attachments[0]
    expect(att).toMatchObject({ kind: 'file', label: 'Portfolio', fileName: 'portfolio.pdf' })
    expect(att.mimeType).toBe('application/pdf') // never the client-declared type

    const dl = await a
      .get(`/api/jobs/${job.id}/attachments/${att.id}/download`)
      .buffer(true)
      .expect(200)
    expect(dl.headers['content-type']).toBe('application/pdf')
    expect(dl.headers['content-disposition']).toMatch(/^attachment;/)
    expect(Buffer.compare(dl.body as Buffer, bytes)).toBe(0)
    const b = await signedIn(bob)
    await b.get(`/api/jobs/${job.id}/attachments/${att.id}/download`).expect(404)

    await a
      .post(`/api/jobs/${job.id}/attachments`)
      .attach('file', Buffer.from('<script>'), { filename: 'x.html', contentType: 'text/html' })
      .expect(400)
    await a
      .post(`/api/jobs/${job.id}/attachments`)
      .send({ label: 'x', url: 'javascript:alert(1)' })
      .expect(400)

    const del = await a.delete(`/api/jobs/${job.id}/attachments/${att.id}`).expect(200)
    expect(del.body.data.materials.attachments).toEqual([])
    expect(await t.storage.get(`attachments/${me.id}/${att.id}.pdf`)).toBeNull()

    const again = await a
      .post(`/api/jobs/${job.id}/attachments`)
      .attach('file', bytes, { filename: 'cv.pdf' })
      .expect(201)
    const key = `attachments/${me.id}/${again.body.data.materials.attachments[0].id}.pdf`
    expect(await t.storage.get(key)).not.toBeNull()
    await a.delete(`/api/jobs/${job.id}`).expect(200)
    expect(await t.storage.get(key)).toBeNull()
  })
})

describe('parse and import', () => {
  it('parses pasted descriptions; AI parse needs AI Pro', async () => {
    const a = await signedIn()
    const parsed = (await a.post('/api/jobs/parse').send({ description: DESC }).expect(200)).body
      .data
    expect(parsed.requirements.map((r: { skill?: string }) => r.skill)).toEqual(
      expect.arrayContaining(['React', 'TypeScript']),
    )
    await a.post('/api/jobs/parse').send({ description: 'too short' }).expect(400)
    const denied = await a.post('/api/jobs/parse-ai').send({ description: DESC }).expect(403)
    expect(denied.body.error.code).toBe('AI_ACCESS_REQUIRED')
    await t.db.user.update({ where: { email: alice.email }, data: { aiAccess: true } })
    await a.post('/api/jobs/parse-ai').send({ description: DESC }).expect(200)
  })

  it('imports Greenhouse via its API and other pages via JSON-LD; failures are 422', async () => {
    const a = await signedIn()
    pages['https://boards-api.greenhouse.io/v1/boards/acme/jobs/123'] = {
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Backend Engineer',
        location: { name: 'Remote' },
        content:
          '&lt;p&gt;Requirements: 5+ years of Node.js and PostgreSQL experience building APIs.&lt;/p&gt;',
        absolute_url: 'https://boards.greenhouse.io/acme/jobs/123',
      }),
    }
    const gh = await a
      .post('/api/jobs/import-url')
      .send({ url: 'https://boards.greenhouse.io/acme/jobs/123' })
      .expect(200)
    expect(gh.body.data.provider).toBe('greenhouse')
    expect(gh.body.data.job.title).toBe('Backend Engineer')

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Data Analyst',
      hiringOrganization: { name: 'Globex' },
      description: 'Requirements: SQL, Python and Tableau. 2+ years of experience in analytics.',
    }
    pages['https://careers.globex.com/jobs/7'] = {
      body: `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head></html>`,
    }
    const page = await a
      .post('/api/jobs/import-url')
      .send({ url: 'https://careers.globex.com/jobs/7' })
      .expect(200)
    expect(page.body.data).toMatchObject({
      provider: 'jsonld',
      job: { title: 'Data Analyst', company: 'Globex' },
    })

    pages['https://www.linkedin.com/jobs/view/1'] = { status: 999, body: '' }
    const fail = await a
      .post('/api/jobs/import-url')
      .send({ url: 'https://www.linkedin.com/jobs/view/1' })
      .expect(422)
    expect(fail.body.error.code).toBe('IMPORT_FAILED')
    await a.post('/api/jobs/import-url').send({ url: 'https://offline.example.com/x' }).expect(422)
    await a.post('/api/jobs/import-url').send({ url: 'file:///etc/passwd' }).expect(400)
  })

  it('the default fetcher refuses internal addresses (SSRF)', async () => {
    const real = testApp() // no fake fetcher → safeFetch
    const a = real.request()
    await a.post('/api/auth/register').send(alice).expect(201)
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:4000/api/health',
    ])
      await a.post('/api/jobs/import-url').send({ url }).expect(422)
    await real.db.$disconnect()
  })
})
