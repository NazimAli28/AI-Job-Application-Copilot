import type { Request, RequestHandler } from 'express'
import { ERROR_CODES } from '@copilot/shared'
import { AppError, demoReadOnly, forbidden, unauthenticated } from '../lib/errors'
import { send } from '../lib/http'

/** 401 unless logged in; 403 for the public read-only demo account. Use on user-owned writes. */
export const requireWritable: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthenticated())
  next(req.user.isDemo ? demoReadOnly() : undefined)
}

/** 401 unless logged in; 403 unless `role=admin` (granted via ADMIN_EMAILS). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthenticated())
  next(req.user.role === 'admin' ? undefined : forbidden('Admins only'))
}

/**
 * 401 unless logged in; 403 `AI_ACCESS_REQUIRED` without the invite-only AI Pro tier (D2);
 * demo (pre-generated AI results) is read-only. Daily quota + monthly cap arrive in Phase 8.
 */
export const requireAiAccess: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthenticated())
  if (!req.user.aiAccess)
    return next(
      new AppError(
        403,
        ERROR_CODES.AI_ACCESS_REQUIRED,
        'AI Pro is invite-only. Request access in Settings.',
      ),
    )
  next(req.user.isDemo ? demoReadOnly() : undefined)
}

/**
 * Demo account on a ✨ route: answer with the pre-generated AI result from the seed (never an
 * LLM call); 403 read-only when the seed has none. Everyone else continues to requireAiAccess.
 */
export const demoStoredAi =
  (load: (req: Request) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    if (!req.user?.isDemo) return next()
    const stored = await load(req)
    if (stored) return void send(res, stored)
    next(
      demoReadOnly('The demo only shows sample AI results — create a free account to run AI Pro'),
    )
  }
