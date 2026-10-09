import { Router } from 'express'
import type { AiUsageInfo } from '@copilot/shared'
import { createAiService } from '../../ai/service'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { requireAuth } from '../auth/sessions'

/** `/ai/usage` — daily AI Pro quota for Settings; admins also see the global monthly budget. */
export function aiRoutes(ctx: AppContext) {
  const ai = createAiService(ctx)
  const r = Router()
  r.use(requireAuth)
  r.get('/usage', async (req, res) => {
    const { monthlyTokens, monthlyTokenCap, ...mine } = await ai.usage(req.user!.id)
    const body: AiUsageInfo =
      req.user!.role === 'admin' ? { ...mine, monthlyTokens, monthlyTokenCap } : mine
    send(res, body)
  })
  return r
}
