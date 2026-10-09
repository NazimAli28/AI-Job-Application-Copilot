import { http, type HttpHandler } from 'msw'
import {
  defaultTracking,
  importUrlInput,
  jobInput,
  needsDescription,
  parseJobDescription,
  parseJobInput,
  skillCorrectionInput,
  statusChangeInput,
  type ApplicationStatus,
  type Job,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, type UserData } from '../db'
import {
  aiAllowed,
  aiLatency,
  auth,
  fail,
  latency,
  notFound,
  now,
  ok,
  parseBody,
  writable,
} from '../utils'
import { importFromUrl } from './job-import'
import { aiMatch, improveParse, recompute } from './jobs-ai'

const today = () => new Date().toISOString().slice(0, 10)
const withScore = (d: UserData, j: Job) => ({
  ...j,
  matchScore: d.matches[j.id]?.score,
  needsDescription: needsDescription(j),
})
const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
/** Changing posting content invalidates cached match/tailoring; tracking-only edits do not. */
const POSTING_KEYS = ['title', 'company', 'description', 'requirements', 'responsibilities', 'experienceYearsMin']

/** Sets a new status: appends history, fills appliedAt on first move out of "saved". */
function applyStatus(j: Job, status: ApplicationStatus, note?: string) {
  if (j.status === status) return
  j.status = status
  j.history = [...j.history, { status, at: now(), note }]
  if (status !== 'saved' && !j.appliedAt) j.appliedAt = today()
}

const IMPORT_FAILED =
  "We couldn't read this page automatically — LinkedIn, Indeed and many sites block it. We saved the link; paste the description when you have it."

export const jobsHandlers: HttpHandler[] = [
  http.get('/api/jobs', async ({ request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const archived = new URL(request.url).searchParams.get('archived') === '1'
    const list = a.data.jobs
      .filter((j) => archived || !j.archived)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    return ok(list.map((j) => withScore(a.data, j)))
  }),

  http.post('/api/jobs/parse', async ({ request }) => {
    await latency(400)
    const a = auth()
    if (a instanceof Response) return a
    const body = await parseBody(request, parseJobInput)
    if (!body.ok) return body.response
    return ok(parseJobDescription(body.value.description))
  }),

  http.post('/api/jobs/parse-ai', async ({ request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const body = await parseBody(request, parseJobInput)
    if (!body.ok) return body.response
    const denied = aiAllowed(a.user)
    if (denied) return denied
    await aiLatency()
    return ok(improveParse(body.value.description))
  }),

  http.post('/api/jobs/import-url', async ({ request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const body = await parseBody(request, importUrlInput)
    if (!body.ok) return body.response
    const result = await importFromUrl(body.value.url)
    return result ? ok(result) : fail(422, 'IMPORT_FAILED', IMPORT_FAILED)
  }),

  http.post('/api/jobs', async ({ request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const body = await parseBody(request, jobInput)
    if (!body.ok) return body.response
    const t = now()
    const job: Job = { ...defaultTracking(), ...defined(body.value), id: uid('job'), createdAt: t, updatedAt: t }
    job.history = [{ status: job.status, at: t }]
    if (job.status !== 'saved' && !job.appliedAt) job.appliedAt = today()
    db.update(a.user.id, (d) => void d.jobs.unshift(job))
    return ok(job, 201)
  }),

  http.get('/api/jobs/:id', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const job = a.data.jobs.find((j) => j.id === params.id)
    return job ? ok(job) : notFound('Job')
  }),

  http.put('/api/jobs/:id', async ({ params, request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const body = await parseBody(request, jobInput.partial())
    if (!body.ok) return body.response
    const updated = db.update(a.user.id, (d) => {
      const j = d.jobs.find((x) => x.id === params.id)
      if (!j) return null
      const { status, ...patch } = defined(body.value)
      Object.assign(j, patch, { updatedAt: now() })
      if (status) applyStatus(j, status)
      if (POSTING_KEYS.some((k) => k in patch)) {
        delete d.matches[j.id]
        delete d.aiMatches[j.id]
      }
      return j
    })
    return updated ? ok(updated) : notFound('Job')
  }),

  http.post('/api/jobs/:id/status', async ({ params, request }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const body = await parseBody(request, statusChangeInput)
    if (!body.ok) return body.response
    const updated = db.update(a.user.id, (d) => {
      const j = d.jobs.find((x) => x.id === params.id)
      if (!j) return null
      applyStatus(j, body.value.status, body.value.note)
      j.updatedAt = now()
      return j
    })
    return updated ? ok(updated) : notFound('Job')
  }),

  http.post('/api/jobs/:id/archive', async ({ params }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const job = db.update(a.user.id, (d) => {
      const j = d.jobs.find((x) => x.id === params.id)
      if (!j) return null
      j.archived = !j.archived
      j.updatedAt = now()
      return j
    })
    return job ? ok(job) : notFound('Job')
  }),

  http.delete('/api/jobs/:id', async ({ params }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const id = String(params.id)
    const found = db.update(a.user.id, (d) => {
      const job = d.jobs.find((j) => j.id === id)
      if (!job) return false
      for (const att of job.materials.attachments) {
        try {
          localStorage.removeItem(`copilot.files.${att.id}`)
        } catch {
          /* storage unavailable */
        }
      }
      d.jobs = d.jobs.filter((j) => j.id !== id)
      delete d.matches[id]
      delete d.aiMatches[id]
      delete d.tailoring[id]
      delete d.aiTailoring[id]
      d.coverLetters = d.coverLetters.filter((c) => c.jobId !== id)
      d.interviewSessions = d.interviewSessions.filter((s) => s.jobId !== id)
      return true
    })
    return found ? ok(null) : notFound('Job')
  }),

  http.get('/api/jobs/:id/match', async ({ params }) => {
    await latency(300)
    const a = auth()
    if (a instanceof Response) return a
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    if (needsDescription(job))
      return fail(409, 'NEEDS_DESCRIPTION', 'Add the job description to see your estimated fit.')
    return ok(db.update(a.user.id, (d) => recompute(d, job)))
  }),

  http.post('/api/jobs/:id/match/ai', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    const denied = aiAllowed(a.user)
    if (denied) return denied
    await aiLatency()
    const result = db.update(a.user.id, (d) => {
      const m = aiMatch(recompute(d, job), job)
      d.aiMatches[job.id] = m
      return m
    })
    return ok(result)
  }),

  http.post('/api/jobs/:id/match/corrections', async ({ params, request }) => {
    await latency(250)
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    const body = await parseBody(request, skillCorrectionInput)
    if (!body.ok) return body.response
    const { skill, action, evidence } = body.value
    const status = action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'learning'
    const m = db.update(a.user.id, (d) => {
      const key = skill.toLowerCase()
      const existing = d.skills.find((s) => s.name.toLowerCase() === key)
      const ev = evidence?.trim() || undefined
      if (existing) {
        existing.status = status
        if (ev) existing.evidence = ev
      } else {
        d.skills.push({ id: uid('skl'), name: skill, status, evidence: ev, source: 'manual' })
      }
      delete d.aiMatches[job.id]
      const r = recompute(d, job)
      r.skills = r.skills.map((s) => (s.skill.toLowerCase() === key ? { ...s, corrected: true } : s))
      return r
    })
    return ok(m)
  }),
]
