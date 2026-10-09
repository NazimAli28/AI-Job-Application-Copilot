import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'

const tierInput = z.object({
  aiAccess: z.boolean().optional(),
  role: z.enum(['user', 'admin']).optional(),
})

/**
 * Prototype toolbar support (preview Free / AI Pro / admin). Mounted only outside production —
 * see createApp. Not part of the public contract.
 */
export function devRoutes({ db }: AppContext) {
  const r = Router()
  r.post('/tier', requireWritable, validate(tierInput), async (req, res) => {
    await db.user.update({ where: { id: req.user!.id }, data: req.body })
    send(res, null)
  })
  return r
}
