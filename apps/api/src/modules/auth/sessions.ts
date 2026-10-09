import type { CookieOptions, RequestHandler, Response } from 'express'
import type { User } from '@copilot/shared'
import type { AppContext } from '../../context'
import type { User as DbUser } from '../../generated/prisma/client'
import { unauthenticated } from '../../lib/errors'
import { hashToken, newToken } from '../../lib/tokens'

const DAY = 24 * 60 * 60 * 1000
export const SESSION_TTL = 30 * DAY
const REFRESH_AFTER = DAY // sliding expiry: extend at most once a day

/** `__Host-` prefix in prod forces Secure + Path=/ + no Domain (can't be planted by subdomains). */
export const cookieName = (isProd: boolean) => (isProd ? '__Host-sid' : 'sid')

const cookieOptions = (isProd: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
})

export const toPublicUser = (u: DbUser): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  aiAccess: u.aiAccess,
  isDemo: u.isDemo,
  createdAt: u.createdAt.toISOString(),
})

function setSessionCookie({ config }: AppContext, res: Response, token: string) {
  res.cookie(cookieName(config.isProd), token, {
    ...cookieOptions(config.isProd),
    maxAge: SESSION_TTL,
  })
}

export async function createSession(
  ctx: AppContext,
  res: Response,
  userId: string,
  userAgent?: string,
) {
  const token = newToken()
  await ctx.db.session.create({
    data: {
      tokenHash: hashToken(token, ctx.config.SESSION_SECRET),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL),
      userAgent: userAgent?.slice(0, 255),
    },
  })
  setSessionCookie(ctx, res, token)
}

export function clearSessionCookie({ config }: AppContext, res: Response) {
  res.clearCookie(cookieName(config.isProd), cookieOptions(config.isProd))
}

/** Reads the session cookie (if any) and sets `req.user`. Never rejects — see requireAuth. */
export const loadSession =
  (ctx: AppContext): RequestHandler =>
  async (req, res, next) => {
    const token: unknown = req.cookies?.[cookieName(ctx.config.isProd)]
    if (typeof token !== 'string' || !token) return next()
    const session = await ctx.db.session.findUnique({
      where: { tokenHash: hashToken(token, ctx.config.SESSION_SECRET) },
      include: { user: true },
    })
    const now = Date.now()
    if (!session || session.expiresAt.getTime() <= now) {
      if (session) await ctx.db.session.deleteMany({ where: { id: session.id } })
      clearSessionCookie(ctx, res)
      return next()
    }
    if (now - session.lastSeenAt.getTime() > REFRESH_AFTER) {
      await ctx.db.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL) },
      })
      setSessionCookie(ctx, res, token)
    }
    req.user = toPublicUser(session.user)
    req.sessionId = session.id
    next()
  }

/** 401 unless logged in. Use on every user-owned route. */
export const requireAuth: RequestHandler = (req, _res, next) =>
  next(req.user ? undefined : unauthenticated())
