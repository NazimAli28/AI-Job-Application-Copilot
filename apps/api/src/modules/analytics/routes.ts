import { Router, type Request } from 'express'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { requireAiAccess } from '../../middleware/access'
import { requireAuth } from '../auth/sessions'
import { analyticsService } from './service'

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id

/** `/dashboard` — read-only overview of the user's own jobs. */
export function dashboardRoutes(ctx: AppContext) {
  const svc = analyticsService(ctx)
  const r = Router()
  r.use(requireAuth)
  r.get('/', async (req, res) => send(res, await svc.dashboard(uid(req))))
  return r
}

/** `/analytics` — computed from non-archived jobs; ✨ insights need AI Pro. */
export function analyticsRoutes(ctx: AppContext) {
  const svc = analyticsService(ctx)
  const r = Router()
  r.use(requireAuth)
  r.get('/', async (req, res) => send(res, await svc.analytics(uid(req))))
  r.post('/ai-insights', requireAiAccess, async (req, res) =>
    send(res, await svc.aiInsights(uid(req))),
  )
  return r
}
