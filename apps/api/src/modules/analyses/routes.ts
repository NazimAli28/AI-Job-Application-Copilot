import { Router, type Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  analysisCoverLetterInput,
  runAnalysisInput,
  saveAnalysisInput,
  type AnalysisCoverLetterInput,
  type RunAnalysisInput,
  type SaveAnalysisInput,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { requireAiAccess, requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { analysisService } from './service'

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id
const aid = (req: Request) => String(req.params.id)

/** "Check my fit" (D11) — `/analyses`. Every query is scoped by userId (other users' ids → 404). */
export function analysisRoutes(ctx: AppContext) {
  const svc = analysisService(ctx)
  const r = Router()
  r.use(requireAuth)
  // A check may import a URL on the user's behalf and runs every engine: cap it per user.
  const runLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: ctx.config.NODE_ENV === 'test' ? 1000 : 60,
    keyGenerator: (req) => uid(req),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many checks. Try again later.' } },
  })

  r.post('/', requireWritable, runLimit, validate(runAnalysisInput), async (req, res) =>
    send(res, await svc.run(uid(req), req.body as RunAnalysisInput)),
  )
  r.get('/', async (req, res) => send(res, await svc.list(uid(req))))
  r.get('/:id', async (req, res) => send(res, await svc.get(uid(req), aid(req))))
  r.delete('/:id', requireWritable, async (req, res) => {
    await svc.remove(uid(req), aid(req))
    send(res, { id: aid(req) })
  })
  r.post('/:id/save', requireWritable, validate(saveAnalysisInput), async (req, res) => {
    const { job, created } = await svc.save(uid(req), aid(req), req.body as SaveAnalysisInput)
    send(res, job, created ? 201 : 200)
  })
  r.post('/:id/cover-letter', validate(analysisCoverLetterInput), async (req, res) =>
    send(res, await svc.coverLetter(uid(req), aid(req), req.body as AnalysisCoverLetterInput)),
  )
  r.post('/:id/ai', requireAiAccess, async (req, res) =>
    send(res, await svc.ai(uid(req), aid(req))),
  )
  return r
}
