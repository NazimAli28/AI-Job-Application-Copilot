import { http, type HttpHandler } from 'msw'
import {
  analysisCoverLetterInput,
  defaultTracking,
  generateCoverLetter,
  runAnalysisInput,
  saveAnalysisInput,
  type Analysis,
  type AnalysisSummary,
  type Job,
  type ParsedJob,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, type UserData } from '../db'
import { aiTailoringFor, buildAnalysis } from '../analysis-builder'
import {
  aiAllowed,
  aiLatency,
  auth,
  profileBundle,
  fail,
  latency,
  notFound,
  now,
  ok,
  parseBody,
  writable,
} from '../utils'
import { importFromUrl } from './job-import'
import { aiMatch } from './jobs-ai'

// "Check my fit" (D11). See docs/kg/api-routes.md.
const MAX_ANALYSES = 20
const IMPORT_FAILED =
  "We couldn't read this page automatically — LinkedIn, Indeed and many sites block it. Paste the job description instead."

const today = () => new Date().toISOString().slice(0, 10)
const summary = (a: Analysis): AnalysisSummary => ({
  id: a.id,
  createdAt: a.createdAt,
  resumeLabel: a.resumeLabel,
  savedJobId: a.savedJobId,
  title: a.job.title,
  company: a.job.company,
  score: a.match.score,
})

/** Rebuilds the engine inputs (temporary job + candidate with resume evidence) for a stored analysis. */
function context(a: Analysis, d: UserData) {
  const resume = d.resumes.find((r) => r.id === a.resumeId)
  const bundle = profileBundle(d)
  if (!resume) {
    const tmpJob: Job = { ...a.job, ...defaultTracking(), id: `tmp_${a.id}`, createdAt: a.createdAt, updatedAt: a.createdAt }
    return { tmpJob, candidate: bundle }
  }
  const built = buildAnalysis({
    id: a.id,
    createdAt: a.createdAt,
    resume,
    bundle,
    description: a.job.description,
    imported: a.job as ParsedJob,
  })
  return { tmpJob: built.job, candidate: built.candidate }
}

export const analysesHandlers: HttpHandler[] = [
  http.post('/api/analyses', async ({ request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const body = await parseBody(request, runAnalysisInput)
    if (!body.ok) return body.response
    const { resumeId, url } = body.value
    let description = body.value.description?.trim() ?? ''
    const resume = a.data.resumes.find((r) => r.id === resumeId)
    if (!resume) return notFound('Resume')

    let imported: ParsedJob | undefined
    let importedFrom: Analysis['importedFrom']
    if (url && description.length < 50) {
      const res = await importFromUrl(url)
      const text = res?.job.description?.trim() ?? ''
      if (!res || text.length < 50) return fail(422, 'IMPORT_FAILED', IMPORT_FAILED)
      imported = res.job
      importedFrom = res.provider
      description = text
    }

    await latency(900)
    const { analysis } = buildAnalysis({
      id: uid('ana'),
      createdAt: now(),
      resume,
      bundle: profileBundle(a.data),
      description,
      url,
      imported,
      importedFrom,
    })
    db.update(a.user.id, (d) => void (d.analyses = [analysis, ...d.analyses].slice(0, MAX_ANALYSES)))
    return ok(analysis)
  }),

  http.get('/api/analyses', async () => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    return ok(a.data.analyses.map(summary))
  }),

  http.get('/api/analyses/:id', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const found = a.data.analyses.find((x) => x.id === params.id)
    return found ? ok(found) : notFound('Analysis')
  }),

  http.delete('/api/analyses/:id', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    if (!a.data.analyses.some((x) => x.id === params.id)) return notFound('Analysis')
    db.update(a.user.id, (d) => void (d.analyses = d.analyses.filter((x) => x.id !== params.id)))
    return ok({ id: params.id })
  }),

  http.post('/api/analyses/:id/save', async ({ params, request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const ro = writable(a.user)
    if (ro) return ro
    const body = await parseBody(request, saveAnalysisInput)
    if (!body.ok) return body.response
    const found = a.data.analyses.find((x) => x.id === params.id)
    if (!found) return notFound('Analysis')
    const existing = found.savedJobId && a.data.jobs.find((j) => j.id === found.savedJobId)
    if (existing) return ok(existing)

    const t = now()
    const { status, title, company } = body.value
    const job: Job = {
      ...found.job,
      ...defaultTracking(),
      ...(title ? { title } : {}),
      ...(company ? { company } : {}),
      ...(found.importedFrom ? { importedFrom: found.importedFrom } : {}),
      id: uid('job'),
      status,
      history: [{ status, at: t }],
      ...(status !== 'saved' ? { appliedAt: today() } : {}),
      materials: { attachments: [], resumeId: found.resumeId },
      createdAt: t,
      updatedAt: t,
    }
    db.update(a.user.id, (d) => {
      d.jobs.unshift(job)
      d.matches[job.id] = { ...found.match, jobId: job.id }
      d.tailoring[job.id] = { ...found.tailoring, jobId: job.id }
      const stored = d.analyses.find((x) => x.id === found.id)
      if (stored) stored.savedJobId = job.id
    })
    return ok(job, 201)
  }),

  http.post('/api/analyses/:id/cover-letter', async ({ params, request }) => {
    await latency(500)
    const a = auth()
    if (a instanceof Response) return a
    const body = await parseBody(request, analysisCoverLetterInput)
    if (!body.ok) return body.response
    const found = a.data.analyses.find((x) => x.id === params.id)
    if (!found) return notFound('Analysis')
    const { tmpJob, candidate } = context(found, a.data)
    return ok({ content: generateCoverLetter(candidate, tmpJob, { ...body.value, highlightIds: [] }) })
  }),

  http.post('/api/analyses/:id/ai', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const found = a.data.analyses.find((x) => x.id === params.id)
    if (!found) return notFound('Analysis')
    const denied = aiAllowed(a.user)
    if (denied) return denied
    await aiLatency()
    const { tmpJob, candidate } = context(found, a.data)
    return ok({
      match: aiMatch(found.match, tmpJob),
      tailoring: aiTailoringFor(candidate, tmpJob, found.tailoring, now()),
    })
  }),
]
