import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const bob = { name: 'Bob Roe', email: 'bob@example.com', password: 'password123' }

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}

const profile = {
  fullName: 'Alice Doe',
  email: 'alice@example.com',
  location: 'Berlin',
  targetTitles: ['Frontend Engineer'],
  yearsExperience: 4,
  workTypes: ['remote'],
  preferredLocations: [],
  salaryCurrency: 'EUR',
}

describe('profile', () => {
  it('starts empty, then PUT upserts and GET returns the bundle', async () => {
    const a = await signedIn()
    const empty = await a.get('/api/profile').expect(200)
    expect(empty.body.data).toEqual({
      profile: null,
      onboardingComplete: false,
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    })

    await a.put('/api/profile').send(profile).expect(200)
    const res = await a
      .put('/api/profile')
      .send({ ...profile, location: undefined })
      .expect(200)
    // Omitted optionals are cleared and never come back as null.
    expect(res.body.data).toEqual({ ...profile, location: undefined })
    expect('location' in res.body.data).toBe(false)
    expect((await a.get('/api/profile')).body.data.profile.fullName).toBe('Alice Doe')
  })

  it('validates with the shared schema and requires login', async () => {
    const a = await signedIn()
    const bad = await a
      .put('/api/profile')
      .send({ ...profile, linkedinUrl: 'nope' })
      .expect(400)
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
    await t.request().get('/api/profile').expect(401)
  })

  it('marks onboarding complete', async () => {
    const a = await signedIn()
    await a.post('/api/profile/onboarding-complete').expect(200)
    expect((await a.get('/api/profile')).body.data.onboardingComplete).toBe(true)
  })
})

describe('profile collections', () => {
  it('creates, patches (merge + revalidate), lists in order and deletes', async () => {
    const a = await signedIn()
    const job = { title: 'Dev', company: 'Acme', startDate: '2022-01', current: true }
    const created = await a
      .post('/api/profile/experience')
      .send({ ...job, bullets: ['Built things'], technologies: ['React'] })
      .expect(201)
    const id = created.body.data.id
    await a
      .post('/api/profile/experience')
      .send({ ...job, company: 'Beta', bullets: [], technologies: [] })

    const patched = await a.patch(`/api/profile/experience/${id}`).send({ title: 'Senior Dev' })
    expect(patched.body.data).toMatchObject({ id, title: 'Senior Dev', company: 'Acme' })
    await a.patch(`/api/profile/experience/${id}`).send({ title: '' }).expect(400)

    const list = await a.get('/api/profile/experience').expect(200)
    expect(list.body.data.map((e: { company: string }) => e.company)).toEqual(['Acme', 'Beta'])

    await a.delete(`/api/profile/experience/${id}`).expect(200)
    await a.delete(`/api/profile/experience/${id}`).expect(404)
  })

  it('rejects duplicate skills case-insensitively (409)', async () => {
    const a = await signedIn()
    const skill = { name: 'TypeScript', status: 'confirmed', source: 'manual' }
    await a.post('/api/profile/skills').send(skill).expect(201)
    const dup = await a.post('/api/profile/skills').send({ ...skill, name: ' typescript ' })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('CONFLICT')
    const other = await a
      .post('/api/profile/skills')
      .send({ ...skill, name: 'React' })
      .expect(201)
    await a
      .patch(`/api/profile/skills/${other.body.data.id}`)
      .send({ name: 'TYPESCRIPT' })
      .expect(409)
  })

  it("hides other users' rows (404, never 403) and keeps them intact", async () => {
    const a = await signedIn()
    const b = await signedIn(bob)
    const own = await a
      .post('/api/profile/projects')
      .send({ name: 'Secret', description: 'x', technologies: [], bullets: [] })
      .expect(201)
    const id = own.body.data.id
    await b.patch(`/api/profile/projects/${id}`).send({ name: 'Hacked' }).expect(404)
    await b.delete(`/api/profile/projects/${id}`).expect(404)
    expect((await b.get('/api/profile/projects')).body.data).toEqual([])
    expect((await a.get('/api/profile/projects')).body.data[0].name).toBe('Secret')
  })
})

describe('import from resume', () => {
  const parsed = {
    contact: { links: [] },
    skills: [],
    technologies: [],
    experience: [
      { title: 'Dev', company: 'Acme', startDate: '2021-03', endDate: 'present', bullets: ['b'] },
    ],
    education: [{ institution: 'TU Berlin', degree: 'BSc', endDate: '2020' }],
    projects: [{ name: 'Copilot', description: 'AI app' }],
    certifications: [],
    achievements: [],
    sections: [],
  }
  const sel = {
    skills: ['React', 'react', 'Node.js'],
    experience: true,
    education: true,
    projects: false,
  }

  /** Stores an active resume row directly (upload + PDF parsing are covered in resumes.test). */
  async function withActiveResume(a: Awaited<ReturnType<typeof signedIn>>) {
    const userId = (await a.get('/api/auth/me')).body.data.id as string
    await t.db.resume.create({
      data: {
        userId,
        fileName: 'cv.pdf',
        fileSize: 1,
        storageKey: `resumes/${userId}/x.pdf`,
        isActive: true,
        text: 'x',
        parsed,
      },
    })
  }

  it('merges the active resume once and is idempotent', async () => {
    const a = await signedIn()
    await withActiveResume(a)
    await a
      .post('/api/profile/skills')
      .send({ name: 'React', status: 'learning', source: 'manual' })
      .expect(201)
    const first = await a.post('/api/profile/import-from-resume').send(sel).expect(200)
    expect(first.body.data).toEqual({ skills: 1, experience: 1, education: 1, projects: 0 })
    const again = await a.post('/api/profile/import-from-resume').send(sel)
    expect(again.body.data).toEqual({ skills: 0, experience: 0, education: 0, projects: 0 })

    const p = (await a.get('/api/profile')).body.data
    expect(p.skills.map((s: { name: string }) => s.name)).toEqual(['React', 'Node.js'])
    expect(p.experience[0]).toMatchObject({ title: 'Dev', current: true, startDate: '2021-03' })
    expect(p.experience[0].endDate).toBeUndefined()
  })

  it('needs a resume', async () => {
    const a = await signedIn()
    await a.post('/api/profile/import-from-resume').send(sel).expect(400)
  })
})

describe('demo account', () => {
  it('can read and finish onboarding but not write', async () => {
    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    await d.get('/api/profile').expect(200)
    await d.post('/api/profile/onboarding-complete').expect(200)
    const res = await d.put('/api/profile').send(profile).expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
    await d
      .post('/api/profile/skills')
      .send({ name: 'Go', status: 'confirmed', source: 'manual' })
      .expect(403)
  })
})
