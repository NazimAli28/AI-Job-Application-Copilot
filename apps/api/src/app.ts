import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import type { AppContext } from './context'
import { send } from './lib/http'
import { errorHandler, notFoundHandler } from './middleware/errors'
import { originCheck } from './middleware/security'
import { accessRoutes, adminRoutes } from './modules/access/routes'
import { aiRoutes } from './modules/ai/routes'
import { analysisRoutes } from './modules/analyses/routes'
import { analyticsRoutes, dashboardRoutes } from './modules/analytics/routes'
import { authRoutes } from './modules/auth/routes'
import { loadSession } from './modules/auth/sessions'
import { devRoutes } from './modules/dev/routes'
import { interviewRoutes } from './modules/interviews/routes'
import { jobRoutes } from './modules/jobs/routes'
import { coverLetterRoutes, jobAssistantRoutes } from './modules/assistant/routes'
import { profileRoutes } from './modules/profile/routes'
import { resumeRoutes } from './modules/resumes/routes'

/** Express app factory — no listen(), so Supertest can drive it directly. */
export function createApp(ctx: AppContext) {
  const { config } = ctx
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)

  app.use(
    pinoHttp({
      logger: ctx.log,
      autoLogging: config.NODE_ENV !== 'test',
      // Keep request logs small; no headers/bodies (cookies, credentials) ever reach the logs.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(helmet())
  // Prod traffic is same-origin via the Vercel /api rewrite; CORS only matters for direct calls.
  app.use(cors({ origin: config.appOrigins, credentials: true }))
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.NODE_ENV === 'test' ? 10_000 : 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down a little.' },
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(originCheck(config.appOrigins))

  const api = Router()
  // Liveness without the database: uptime checks / keep-warm pings must not keep Neon's free
  // compute awake around the clock.
  api.get('/health/live', (_req, res) => send(res, { status: 'ok' }))
  api.get('/health', async (_req, res) => {
    await ctx.db.$queryRaw`SELECT 1`
    send(res, { status: 'ok' })
  })
  api.use(loadSession(ctx))
  api.use('/auth', authRoutes(ctx))
  api.use('/profile', profileRoutes(ctx))
  api.use('/resumes', resumeRoutes(ctx))
  api.use('/jobs', jobRoutes(ctx))
  api.use('/jobs/:id', jobAssistantRoutes(ctx))
  api.use('/cover-letters', coverLetterRoutes(ctx))
  api.use('/analyses', analysisRoutes(ctx))
  api.use('/interviews', interviewRoutes(ctx))
  api.use('/dashboard', dashboardRoutes(ctx))
  api.use('/analytics', analyticsRoutes(ctx))
  api.use('/ai', aiRoutes(ctx))
  api.use('/access-requests', accessRoutes(ctx))
  api.use('/admin', adminRoutes(ctx))
  if (!config.isProd) api.use('/dev', devRoutes(ctx))

  app.use('/api', api)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
