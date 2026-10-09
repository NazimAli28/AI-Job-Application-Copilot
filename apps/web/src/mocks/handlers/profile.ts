import { http } from 'msw'
import { z } from 'zod'
import {
  ERROR_CODES,
  certificationSchema,
  educationSchema,
  experienceSchema,
  profileImportInput,
  profileSchema,
  profileSkillSchema,
  projectSchema,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, type UserData } from '../db'
import { auth, fail, latency, notFound, ok, parseBody, writable } from '../utils'

type CollectionKey = 'skills' | 'experience' | 'education' | 'projects' | 'certifications'
type Row = { id: string }

const profileView = (d: UserData) => ({
  profile: d.profile,
  onboardingComplete: d.onboardingComplete,
  skills: d.skills,
  experience: d.experience,
  education: d.education,
  projects: d.projects,
  certifications: d.certifications,
})

/** Generates list/create/update/delete routes for one profile collection. */
function collectionRoutes(key: CollectionKey, schema: z.ZodObject<z.ZodRawShape>, prefix: string) {
  const createSchema = schema.omit({ id: true })
  const rows = (d: UserData) => d[key] as unknown as Row[]
  const base = `/api/profile/${prefix}`
  return [
    http.get(base, async () => {
      await latency(150)
      const a = auth()
      return a instanceof Response ? a : ok(rows(a.data))
    }),
    http.post(base, async ({ request }) => {
      await latency()
      const a = auth()
      if (a instanceof Response) return a
      const blocked = writable(a.user)
      if (blocked) return blocked
      const body = await parseBody(request, createSchema)
      if (!body.ok) return body.response
      const name = (body.value as { name?: unknown }).name
      if (
        key === 'skills' &&
        typeof name === 'string' &&
        a.data.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())
      )
        return fail(409, ERROR_CODES.CONFLICT, `"${name}" is already in your skills`)
      const row = { id: uid(prefix.slice(0, 3)), ...body.value } as Row
      db.update(a.user.id, (d) => void rows(d).push(row))
      return ok(row, 201)
    }),
    http.patch(`${base}/:id`, async ({ request, params }) => {
      await latency()
      const a = auth()
      if (a instanceof Response) return a
      const blocked = writable(a.user)
      if (blocked) return blocked
      const existing = rows(a.data).find((r) => r.id === params.id)
      if (!existing) return notFound()
      const patch = await parseBody(request, createSchema.partial())
      if (!patch.ok) return patch.response
      const merged = schema.safeParse({ ...existing, ...patch.value, id: existing.id })
      if (!merged.success)
        return fail(400, ERROR_CODES.VALIDATION, 'Please check the highlighted fields', merged.error.issues)
      db.update(a.user.id, (d) => {
        const list = rows(d)
        list[list.findIndex((r) => r.id === existing.id)] = merged.data as Row
      })
      return ok(merged.data)
    }),
    http.delete(`${base}/:id`, async ({ params }) => {
      await latency()
      const a = auth()
      if (a instanceof Response) return a
      const blocked = writable(a.user)
      if (blocked) return blocked
      if (!rows(a.data).some((r) => r.id === params.id)) return notFound()
      db.update(a.user.id, (d) => {
        ;(d[key] as unknown as Row[]) = rows(d).filter((r) => r.id !== params.id)
      })
      return ok(null)
    }),
  ]
}

const norm = (s: string) => s.trim().toLowerCase()

export const profileHandlers = [
  http.get('/api/profile', async () => {
    await latency(150)
    const a = auth()
    return a instanceof Response ? a : ok(profileView(a.data))
  }),

  http.put('/api/profile', async ({ request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const body = await parseBody(request, profileSchema)
    if (!body.ok) return body.response
    db.update(a.user.id, (d) => void (d.profile = body.value))
    return ok(body.value)
  }),

  http.post('/api/profile/onboarding-complete', async () => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    // Allowed for the demo user too: it only flips a UI flag.
    db.update(a.user.id, (d) => void (d.onboardingComplete = true))
    return ok({ onboardingComplete: true })
  }),

  ...collectionRoutes('skills', profileSkillSchema, 'skills'),
  ...collectionRoutes('experience', experienceSchema, 'experience'),
  ...collectionRoutes('education', educationSchema, 'education'),
  ...collectionRoutes('projects', projectSchema, 'projects'),
  ...collectionRoutes('certifications', certificationSchema, 'certifications'),

  http.post('/api/profile/import-from-resume', async ({ request }) => {
    await latency(400)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const body = await parseBody(request, profileImportInput)
    if (!body.ok) return body.response
    const parsed = a.data.resumes.find((r) => r.isActive)?.parsed
    if (!parsed) return fail(400, ERROR_CODES.VALIDATION, 'Upload a resume first')
    const sel = body.value
    const result = db.update(a.user.id, (d) => {
      let skills = 0
      let experience = 0
      let education = 0
      let projects = 0
      for (const name of sel.skills) {
        if (d.skills.some((s) => norm(s.name) === norm(name))) continue
        d.skills.push({ id: uid('ski'), name, status: 'confirmed', source: 'resume' })
        skills++
      }
      if (sel.experience)
        for (const e of parsed.experience) {
          if (d.experience.some((x) => norm(x.title) === norm(e.title) && norm(x.company) === norm(e.company))) continue
          d.experience.push({
            id: uid('exp'),
            title: e.title,
            company: e.company,
            startDate: e.startDate ?? '',
            endDate: e.endDate && e.endDate !== 'present' ? e.endDate : undefined,
            current: !e.endDate || e.endDate === 'present',
            bullets: e.bullets,
            technologies: [],
          })
          experience++
        }
      if (sel.education)
        for (const e of parsed.education) {
          if (d.education.some((x) => norm(x.institution) === norm(e.institution) && norm(x.degree) === norm(e.degree))) continue
          d.education.push({ id: uid('edu'), institution: e.institution, degree: e.degree, endDate: e.endDate })
          education++
        }
      if (sel.projects)
        for (const p of parsed.projects) {
          if (d.projects.some((x) => norm(x.name) === norm(p.name))) continue
          d.projects.push({ id: uid('pro'), name: p.name, description: p.description, technologies: [], bullets: [] })
          projects++
        }
      return { skills, experience, education, projects }
    })
    return ok(result)
  }),
]
