import { Router, type Request, type RequestHandler } from 'express'
import {
  createInterviewInput,
  submitAnswerInput,
  type CreateInterviewInput,
  type SubmitAnswerInput,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { requireAiAccess, requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { interviewService } from './service'

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id
const sid = (req: Request) => String(req.params.id)
const wantsAi = (req: Request) => req.query.ai === '1'

/** `?ai=1` answer evaluation is AI Pro (✨). */
const aiWhenAsked: RequestHandler = (req, res, next) =>
  wantsAi(req) ? requireAiAccess(req, res, next) : next()

/** Interview sessions — `/interviews`. Other users' sessions/jobs → 404. */
export function interviewRoutes(ctx: AppContext) {
  const svc = interviewService(ctx)
  const r = Router()
  r.use(requireAuth)

  r.get('/', async (req, res) => send(res, await svc.list(uid(req))))
  r.post('/', requireWritable, validate(createInterviewInput), async (req, res) =>
    send(res, await svc.create(uid(req), req.body as CreateInterviewInput), 201),
  )
  r.get('/:id', async (req, res) => send(res, await svc.get(uid(req), sid(req))))
  r.delete('/:id', requireWritable, async (req, res) => {
    await svc.remove(uid(req), sid(req))
    send(res, null)
  })
  r.post(
    '/:id/answers',
    requireWritable,
    aiWhenAsked,
    validate(submitAnswerInput),
    async (req, res) =>
      send(res, await svc.answer(uid(req), sid(req), req.body as SubmitAnswerInput, wantsAi(req))),
  )
  r.post('/:id/complete', requireWritable, async (req, res) =>
    send(res, await svc.complete(uid(req), sid(req))),
  )
  return r
}
