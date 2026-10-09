import { Router, type Request, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  buildQuestionSet,
  coverLetterInput,
  skillCorrectionInput,
  type CoverLetterInput,
  type SkillCorrectionInput,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { demoStoredAi, requireAiAccess, requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { jobService } from '../jobs/service'
import { createAiService } from '../../ai/service'
import { questionsTask } from '../../ai/tasks/interview'
import { candidateLoader } from './bundle'
import { documentService, type Source, type SuggestionPatch } from './documents'
import { matchService } from './match'

const suggestionPatch = z.object({
  status: z.enum(['accepted', 'rejected']),
  suggested: z.string().trim().min(1).max(600).optional(),
})
const contentBody = z.object({ content: z.string().min(1, 'Letter cannot be empty').max(8000) })

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id
const source = (req: Request): Source => (req.query.source === 'ai' ? 'ai' : 'rules')

/** AI Pro cover letters (`useAi`) pass the same gate as the ✨ routes. */
const aiWhenAsked: RequestHandler = (req, res, next) =>
  (req.body as CoverLetterInput).useAi ? requireAiAccess(req, res, next) : next()

/**
 * Match, tailoring, cover letters and interview questions for one job (mounted at `/jobs/:id`).
 * The job is loaded with the caller's userId first, so another user's job id → 404.
 */
export function jobAssistantRoutes(ctx: AppContext) {
  const jobs = jobService(ctx)
  const candidateFor = candidateLoader(ctx)
  const match = matchService(ctx)
  const docs = documentService(ctx)
  const ai = createAiService(ctx)
  const r = Router({ mergeParams: true })
  r.use(requireAuth)

  const job = (req: Request) => jobs.get(uid(req), String(req.params.id))
  const withCandidate = async (req: Request) => {
    const j = await job(req)
    return { job: j, c: await candidateFor(uid(req), j) }
  }

  r.get('/match', async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(res, await match.rules(j, c))
  })
  const storedMatch = demoStoredAi(async (req) => {
    const row = await ctx.db.jobMatch.findUnique({
      where: { jobId_source: { jobId: (await job(req)).id, source: 'ai' } },
    })
    return row?.result
  })
  const storedTailoring = demoStoredAi(async (req) => docs.getTailoring((await job(req)).id, 'ai'))

  r.post('/match/ai', storedMatch, requireAiAccess, async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(res, await match.ai(uid(req), j, c))
  })
  r.post(
    '/match/corrections',
    requireWritable,
    validate(skillCorrectionInput),
    async (req, res) => {
      const j = await job(req)
      const input = req.body as SkillCorrectionInput
      send(res, await match.correct(uid(req), j, input, () => candidateFor(uid(req), j)))
    },
  )

  r.get('/tailoring', async (req, res) =>
    send(res, await docs.getTailoring((await job(req)).id, source(req))),
  )
  r.post('/tailoring', requireWritable, async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(res, await docs.tailor(j, c))
  })
  r.post('/tailoring/ai', storedTailoring, requireAiAccess, async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(res, await docs.tailorAi(uid(req), j, c))
  })
  r.patch(
    '/tailoring/suggestions/:sid',
    requireWritable,
    validate(suggestionPatch),
    async (req, res) => {
      const j = await job(req)
      const patch = req.body as SuggestionPatch
      send(res, await docs.patchSuggestion(j.id, source(req), String(req.params.sid), patch))
    },
  )

  r.get('/cover-letters', async (req, res) =>
    send(res, await docs.listLetters(uid(req), (await job(req)).id)),
  )
  r.post(
    '/cover-letters',
    requireWritable,
    validate(coverLetterInput),
    aiWhenAsked,
    async (req, res) => {
      const { job: j, c } = await withCandidate(req)
      send(res, await docs.createLetter(uid(req), j, c, req.body as CoverLetterInput), 201)
    },
  )

  r.get('/interview-questions', async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(res, buildQuestionSet(c.bundle, j))
  })
  r.post('/interview-questions/ai', requireAiAccess, async (req, res) => {
    const { job: j, c } = await withCandidate(req)
    send(
      res,
      await ai.run(uid(req), questionsTask, { bundle: c.bundle, profile: c.profile, job: j }),
    )
  })

  return r
}

/** Edit/delete a stored letter by its own id (`/cover-letters/:id`). */
export function coverLetterRoutes(ctx: AppContext) {
  const docs = documentService(ctx)
  const r = Router()
  r.use(requireAuth)
  r.put('/:id', requireWritable, validate(contentBody), async (req, res) => {
    const { content } = req.body as { content: string }
    send(res, await docs.updateLetter(uid(req), String(req.params.id), content))
  })
  r.delete('/:id', requireWritable, async (req, res) => {
    await docs.removeLetter(uid(req), String(req.params.id))
    send(res, null)
  })
  return r
}
