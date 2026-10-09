import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { forgotPasswordInput, loginInput, registerInput, resetPasswordInput } from '@copilot/shared'
import type { AppContext } from '../../context'
import { send } from '../../lib/http'
import { validate } from '../../middleware/validate'
import { authService } from './service'
import { requireAuth } from './sessions'

export function authRoutes(ctx: AppContext) {
  const svc = authService(ctx)
  const r = Router()

  // Brute-force / credential-stuffing brake on endpoints that check secrets or send email.
  const strict = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: ctx.config.NODE_ENV === 'test' ? 1000 : 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
  })

  r.get('/me', requireAuth, (req, res) => send(res, req.user))

  r.post('/register', strict, validate(registerInput), async (req, res) =>
    send(res, await svc.register(req.body, res, req.get('user-agent')), 201),
  )
  r.post('/login', strict, validate(loginInput), async (req, res) =>
    send(res, await svc.login(req.body, res, req.get('user-agent'))),
  )
  r.post('/demo', async (req, res) => send(res, await svc.demo(res, req.get('user-agent'))))
  r.post('/logout', async (req, res) => {
    await svc.logout(req.sessionId, res)
    send(res, null)
  })
  r.post('/forgot-password', strict, validate(forgotPasswordInput), async (req, res) =>
    send(res, await svc.forgotPassword(req.body.email)),
  )
  r.post('/reset-password', strict, validate(resetPasswordInput), async (req, res) =>
    send(res, await svc.resetPassword(req.body)),
  )

  return r
}
