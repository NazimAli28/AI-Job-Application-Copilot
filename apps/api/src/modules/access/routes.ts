import { Router } from 'express'
import { accessRequestInput } from '@copilot/shared'
import type { AppContext } from '../../context'
import { notFound } from '../../lib/errors'
import { send } from '../../lib/http'
import { requireAdmin } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { accessService, type Decision } from './service'

const DECISIONS = new Set<string>(['approve', 'deny'])

/** `/access-requests` — the current user's AI Pro request. */
export function accessRoutes(ctx: AppContext) {
  const svc = accessService(ctx)
  const r = Router()
  r.use(requireAuth)
  r.get('/mine', async (req, res) => send(res, await svc.mine(req.user!.id)))
  r.post('/', validate(accessRequestInput), async (req, res) =>
    send(res, await svc.request(req.user!, req.body.reason), 201),
  )
  return r
}

/** `/admin` — admins only (role from ADMIN_EMAILS, re-read from the DB on every request). */
export function adminRoutes(ctx: AppContext) {
  const svc = accessService(ctx)
  const r = Router()
  r.use(requireAdmin)
  r.get('/access-requests', async (_req, res) => send(res, await svc.list()))
  r.post('/access-requests/:id/:decision', async (req, res) => {
    const decision = String(req.params.decision)
    if (!DECISIONS.has(decision)) throw notFound('Route')
    send(res, await svc.decide(req.user!.id, String(req.params.id), decision as Decision))
  })
  return r
}
