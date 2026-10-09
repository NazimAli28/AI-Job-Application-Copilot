import { resumeSchema } from '@copilot/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'
import { makePdf, sampleResumeLines } from '../../test/pdf'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }
const pdf = makePdf(sampleResumeLines)

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}

type Agent = Awaited<ReturnType<typeof signedIn>>
const uploadAs = (a: Agent, name = 'alice-cv.pdf', fields: Record<string, string> = {}) => {
  let req = a
    .post('/api/resumes')
    .attach('file', pdf, { filename: name, contentType: 'application/pdf' })
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  return req
}

describe('resume upload', () => {
  it('extracts, parses and analyzes a PDF; first upload becomes active', async () => {
    const a = await signedIn()
    const res = await uploadAs(a, 'alice-cv.pdf', { label: ' Frontend v1 ' }).expect(201)
    const r = resumeSchema.parse(res.body.data)
    expect(r).toMatchObject({ fileName: 'alice-cv.pdf', label: 'Frontend v1', isActive: true })
    expect(r.status).toBe('ready')
    expect(r.text).toBeUndefined()
    expect(r.parsed?.contact.email).toBe('alice@example.com')
    expect(r.parsed?.skills).toEqual(expect.arrayContaining(['React', 'TypeScript']))
    expect(r.analysis?.source).toBe('rules')
    expect(r.analysis?.overallScore).toBeGreaterThan(0)
    // Stored file round-trips.
    const dl = await a.get(`/api/resumes/${r.id}/download`).buffer(true).expect(200)
    expect(dl.headers['content-type']).toBe('application/pdf')
    expect(dl.headers['content-disposition']).toContain('alice-cv.pdf')
    expect(Buffer.compare(dl.body as Buffer, pdf)).toBe(0)
    // Full read includes the text; the list does not.
    expect((await a.get(`/api/resumes/${r.id}`)).body.data.text).toContain('Acme')
    expect((await a.get('/api/resumes')).body.data[0].text).toBeUndefined()

    // Uploaded from a job's Resume tab → linked both ways; unknown/foreign job → 404.
    const job = await a
      .post('/api/jobs')
      .send({
        title: 'Dev',
        company: 'Acme',
        description: '',
        responsibilities: [],
        requirements: [],
      })
      .expect(201)
    const jobId = job.body.data.id as string
    const second = await uploadAs(a, 'v2.pdf', { jobId }).expect(201)
    expect(second.body.data).toMatchObject({ isActive: false, jobId })
    expect((await a.get(`/api/jobs/${jobId}`)).body.data.materials.resumeId).toBe(
      second.body.data.id,
    )
    await uploadAs(a, 'v3.pdf', { jobId: 'job_123' }).expect(404)
    // Deleting the resume unlinks it from the job.
    await a.delete(`/api/resumes/${second.body.data.id}`).expect(200)
    expect((await a.get(`/api/jobs/${jobId}`)).body.data.materials.resumeId).toBeUndefined()
  })

  it('rejects non-PDFs, oversize files, unreadable PDFs and missing files', async () => {
    const a = await signedIn()
    const fake = await a
      .post('/api/resumes')
      .attach('file', Buffer.from('hello world, definitely not a pdf'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(400)
    expect(fake.body.error.code).toBe('VALIDATION_ERROR')
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024)])
    const tooBig = await a
      .post('/api/resumes')
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
      .expect(400)
    expect(tooBig.body.error.message).toMatch(/4 MB/)
    await a
      .post('/api/resumes')
      .attach('file', makePdf([]), { filename: 'blank.pdf', contentType: 'application/pdf' })
      .expect(422)
    await a.post('/api/resumes').field('label', 'x').expect(400)
    expect((await a.get('/api/resumes')).body.data).toEqual([])
    expect(await t.db.resume.count()).toBe(0)
  })

  it('requires login and blocks the read-only demo', async () => {
    await t.request().get('/api/resumes').expect(401)
    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    const res = await uploadAs(d).expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
  })
})

describe('resume library', () => {
  it('labels, activates and deletes (active moves to newest remaining)', async () => {
    const a = await signedIn()
    const first = (await uploadAs(a, 'one.pdf').expect(201)).body.data
    const second = (await uploadAs(a, 'two.pdf').expect(201)).body.data
    const third = (await uploadAs(a, 'three.pdf').expect(201)).body.data

    const patched = await a
      .patch(`/api/resumes/${second.id}`)
      .send({ label: 'Tailored' })
      .expect(200)
    expect(patched.body.data.label).toBe('Tailored')
    await a
      .patch(`/api/resumes/${second.id}`)
      .send({ label: 'x'.repeat(81) })
      .expect(400)
    const cleared = await a.patch(`/api/resumes/${second.id}`).send({ label: '  ' }).expect(200)
    expect(cleared.body.data.label).toBeUndefined()

    await a.post(`/api/resumes/${second.id}/activate`).expect(200)
    let list = (await a.get('/api/resumes')).body.data as Array<{ id: string; isActive: boolean }>
    expect(list.map((r) => r.id)).toEqual([third.id, second.id, first.id])
    expect(list.filter((r) => r.isActive).map((r) => r.id)).toEqual([second.id])

    await a.delete(`/api/resumes/${second.id}`).expect(200)
    list = (await a.get('/api/resumes')).body.data
    expect(list.filter((r) => r.isActive).map((r) => r.id)).toEqual([third.id])
    await a.get(`/api/resumes/${second.id}/download`).expect(404)
    const row = await t.db.resume.findUnique({ where: { id: third.id } })
    expect(await t.storage.get(`resumes/${row!.userId}/${second.id}.pdf`)).toBeNull()
  })

  it("hides other users' resumes (404)", async () => {
    const a = await signedIn()
    const id = (await uploadAs(a).expect(201)).body.data.id
    const b = await signedIn(bob)
    expect((await b.get('/api/resumes')).body.data).toEqual([])
    await b.get(`/api/resumes/${id}`).expect(404)
    await b.get(`/api/resumes/${id}/download`).expect(404)
    await b.patch(`/api/resumes/${id}`).send({ label: 'mine' }).expect(404)
    await b.post(`/api/resumes/${id}/activate`).expect(404)
    await b.delete(`/api/resumes/${id}`).expect(404)
    expect((await a.get('/api/resumes')).body.data).toHaveLength(1)
  })

  it('AI analysis needs AI Pro and is stored on the resume', async () => {
    const a = await signedIn()
    const id = (await uploadAs(a).expect(201)).body.data.id
    const denied = await a.post(`/api/resumes/${id}/ai-analysis`).expect(403)
    expect(denied.body.error.code).toBe('AI_ACCESS_REQUIRED')

    await a.post('/api/dev/tier').send({ aiAccess: true }).expect(200)
    const ai = await a.post(`/api/resumes/${id}/ai-analysis`).expect(200)
    expect(ai.body.data.source).toBe('ai')
    expect((await a.get('/api/resumes')).body.data[0].aiAnalysis.source).toBe('ai')
  })

  it('profile import reads the active stored resume', async () => {
    const a = await signedIn()
    await uploadAs(a).expect(201)
    const res = await a
      .post('/api/profile/import-from-resume')
      .send({ skills: ['React'], experience: true, education: true, projects: false })
      .expect(200)
    expect(res.body.data.skills).toBe(1)
    expect(res.body.data.experience).toBeGreaterThanOrEqual(1)
  })
})
