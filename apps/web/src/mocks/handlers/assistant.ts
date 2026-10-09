import { http } from 'msw'
import { z } from 'zod'
import {
  computeMatch,
  coverLetterInput,
  generateCoverLetter,
  tailorResume,
  type BulletSuggestion,
  type CoverLetterInput,
  type TailoringResult,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, type UserData } from '../db'
import { aiAllowed, aiLatency, auth, bundleOf, latency, notFound, now, ok, parseBody, writable } from '../utils'

const suggestionPatch = z.object({
  status: z.enum(['accepted', 'rejected']),
  suggested: z.string().trim().min(1).max(600).optional(),
})
const contentBody = z.object({ content: z.string().min(1, 'Letter cannot be empty').max(8000) })

const findJob = (d: UserData, id: unknown) => d.jobs.find((j) => j.id === id)
const metricFree = (s: string) => !/\d/.test(s) && !s.includes('[add metric]')
const stripEnd = (s: string) => s.trim().replace(/[.!?;:,\s]+$/, '')

/** AI-style tailoring: rephrases REAL profile content only; never adds facts. */
function aiTailoring(d: UserData, jobId: string): TailoringResult {
  const job = findJob(d, jobId)!
  const bundle = bundleOf(d, job)
  const match = computeMatch(bundle, job)
  const base = tailorResume(bundle, job, match)
  const strong = match.skills.filter((s) => s.status === 'strong').map((s) => s.skill)
  const p = d.profile
  const latest = [...d.experience].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate),
  )[0]
  const parts = [
    latest ? `${latest.title} at ${latest.company}` : (p?.targetTitles[0] ?? 'Candidate'),
    p && p.yearsExperience > 0 ? `with ${p.yearsExperience} years of experience` : '',
    strong.length ? `working hands-on with ${strong.slice(0, 4).join(', ')}` : '',
    `applying for the ${job.title} role at ${job.company}`,
  ].filter(Boolean)
  const skillSet = strong.map((s) => s.toLowerCase())
  const bullets: BulletSuggestion[] = []
  for (const e of d.experience) {
    for (const b of e.bullets) {
      if (bullets.length >= 4) break
      const relevant = skillSet.some((s) => b.toLowerCase().includes(s))
      if (!relevant && bullets.length >= 2) continue
      const text = stripEnd(b)
      const needsMetric = metricFree(text)
      const suggested = needsMetric ? `${text} [add metric]` : text.charAt(0).toUpperCase() + text.slice(1)
      if (suggested === b) continue
      bullets.push({
        id: uid('sug'),
        section: `${e.title} @ ${e.company}`,
        original: b,
        suggested,
        reason: needsMetric
          ? 'Reworded for clarity. If you have a real number (scale, time saved, users), replace "[add metric]" - otherwise delete it.'
          : 'Reworded to lead with the action and keep your original figures.',
        status: 'pending',
      })
    }
  }
  return { ...base, summary: `${parts.join(', ')}.`, bulletSuggestions: bullets, source: 'ai', createdAt: now() }
}

function aiLetter(d: UserData, jobId: string, input: CoverLetterInput) {
  const text = generateCoverLetter(bundleOf(d, findJob(d, jobId)), findJob(d, jobId)!, input)
  return `${text}\n\n(Drafted with AI Pro from your profile facts only. Review and edit before sending.)`
}

export const assistantHandlers = [
  http.get('/api/jobs/:id/tailoring', async ({ params, request }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    if (!findJob(a.data, params.id)) return notFound('Job')
    const ai = new URL(request.url).searchParams.get('source') === 'ai'
    return ok((ai ? a.data.aiTailoring : a.data.tailoring)[params.id as string] ?? null)
  }),

  http.post('/api/jobs/:id/tailoring', async ({ params }) => {
    await latency(500)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const job = findJob(a.data, params.id)
    if (!job) return notFound('Job')
    const bundle = bundleOf(a.data, job)
    const result = tailorResume(bundle, job, computeMatch(bundle, job))
    db.update(a.user.id, (d) => void (d.tailoring[job.id] = result))
    return ok(result)
  }),

  http.post('/api/jobs/:id/tailoring/ai', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const job = findJob(a.data, params.id)
    if (!job) return notFound('Job')
    const blocked = aiAllowed(a.user)
    if (blocked) return blocked
    await aiLatency()
    const result = aiTailoring(a.data, job.id)
    db.update(a.user.id, (d) => void (d.aiTailoring[job.id] = result))
    return ok(result)
  }),

  http.patch('/api/jobs/:id/tailoring/suggestions/:sid', async ({ params, request }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const body = await parseBody(request, suggestionPatch)
    if (!body.ok) return body.response
    const store = new URL(request.url).searchParams.get('source') === 'ai' ? 'aiTailoring' : 'tailoring'
    const result = a.data[store][params.id as string]
    const sug = result?.bulletSuggestions.find((s) => s.id === params.sid)
    if (!result || !sug) return notFound('Suggestion')
    db.update(a.user.id, () => {
      sug.status = body.value.status
      if (body.value.suggested) sug.suggested = body.value.suggested
    })
    return ok(result)
  }),

  http.get('/api/jobs/:id/cover-letters', async ({ params }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    if (!findJob(a.data, params.id)) return notFound('Job')
    return ok(
      a.data.coverLetters
        .filter((l) => l.jobId === params.id)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    )
  }),

  http.post('/api/jobs/:id/cover-letters', async ({ params, request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const job = findJob(a.data, params.id)
    if (!job) return notFound('Job')
    const body = await parseBody(request, coverLetterInput)
    if (!body.ok) return body.response
    const useAi = !!body.value.useAi
    if (useAi) {
      const denied = aiAllowed(a.user)
      if (denied) return denied
      await aiLatency()
    } else await latency(500)
    const content = useAi
      ? aiLetter(a.data, job.id, body.value)
      : generateCoverLetter(bundleOf(a.data, job), job, body.value)
    const letter = {
      id: uid('cl'),
      jobId: job.id,
      length: body.value.length,
      tone: body.value.tone,
      content,
      source: useAi ? ('ai' as const) : ('rules' as const),
      createdAt: now(),
      updatedAt: now(),
    }
    db.update(a.user.id, (d) => void d.coverLetters.push(letter))
    return ok(letter, 201)
  }),

  http.put('/api/cover-letters/:id', async ({ params, request }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const body = await parseBody(request, contentBody)
    if (!body.ok) return body.response
    const letter = a.data.coverLetters.find((l) => l.id === params.id)
    if (!letter) return notFound('Cover letter')
    db.update(a.user.id, () => {
      letter.content = body.value.content
      letter.updatedAt = now()
    })
    return ok(letter)
  }),

  http.delete('/api/cover-letters/:id', async ({ params }) => {
    await latency(200)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    if (!a.data.coverLetters.some((l) => l.id === params.id)) return notFound('Cover letter')
    db.update(a.user.id, (d) => void (d.coverLetters = d.coverLetters.filter((l) => l.id !== params.id)))
    return ok(null)
  }),
]
