import type { LoginInput, RegisterInput, ResetPasswordInput } from '@copilot/shared'
import type { Response } from 'express'
import type { AppContext } from '../../context'
import { badRequest, conflict, unauthenticated } from '../../lib/errors'
import { hashPassword, verifyPassword } from '../../lib/password'
import { hashToken, newToken } from '../../lib/tokens'
import { ensureDemoUser } from '../demo/seed'
import { clearSessionCookie, createSession, toPublicUser } from './sessions'

const RESET_TTL = 30 * 60 * 1000
const GENERIC_RESET_MESSAGE = 'If that email exists, a reset link has been sent.'

export function authService(ctx: AppContext) {
  const { db, config } = ctx
  const roleFor = (email: string) =>
    config.ADMIN_EMAILS.includes(email) ? ('admin' as const) : ('user' as const)

  return {
    async register(input: RegisterInput, res: Response, userAgent?: string) {
      const email = input.email.toLowerCase()
      if (await db.user.findUnique({ where: { email } }))
        throw conflict('An account with this email already exists')
      const user = await db.user
        .create({
          data: {
            email,
            name: input.name,
            passwordHash: await hashPassword(input.password),
            role: roleFor(email),
          },
        })
        .catch((e: { code?: string }) => {
          // Lost a race with a concurrent signup for the same email.
          if (e.code === 'P2002') throw conflict('An account with this email already exists')
          throw e
        })
      await createSession(ctx, res, user.id, userAgent)
      return toPublicUser(user)
    },

    async login(input: LoginInput, res: Response, userAgent?: string) {
      const email = input.email.toLowerCase()
      let user = await db.user.findUnique({ where: { email } })
      const ok = await verifyPassword(user?.isDemo ? null : user?.passwordHash, input.password)
      // Same message for unknown email and wrong password (no account enumeration).
      if (!user || !ok) throw unauthenticated('Incorrect email or password')
      // ADMIN_EMAILS can be added after signup — promote on next login.
      if (user.role !== 'admin' && roleFor(email) === 'admin')
        user = await db.user.update({ where: { id: user.id }, data: { role: 'admin' } })
      await db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
      await createSession(ctx, res, user.id, userAgent)
      return toPublicUser(user)
    },

    /** Public read-only sample account (D2), (re)seeded server-side (modules/demo). */
    async demo(res: Response, userAgent?: string) {
      const user = await ensureDemoUser(ctx)
      await createSession(ctx, res, user.id, userAgent)
      return toPublicUser(user)
    },

    async logout(sessionId: string | undefined, res: Response) {
      if (sessionId) await db.session.deleteMany({ where: { id: sessionId } })
      clearSessionCookie(ctx, res)
    },

    async forgotPassword(rawEmail: string) {
      const email = rawEmail.toLowerCase()
      const user = await db.user.findUnique({ where: { email } })
      if (!user || user.isDemo) return { message: GENERIC_RESET_MESSAGE }
      const token = newToken()
      await db.$transaction([
        db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        db.passwordResetToken.create({
          data: {
            tokenHash: hashToken(token, config.SESSION_SECRET),
            userId: user.id,
            expiresAt: new Date(Date.now() + RESET_TTL),
          },
        }),
      ])
      const path = `/reset-password?token=${token}`
      // A mail failure must not 500 (or otherwise reveal that the account exists).
      try {
        await ctx.mailer.send({
          to: user.email,
          subject: 'Reset your password',
          text: `Reset your password (valid 30 minutes): ${config.appOrigins[0]}${path}`,
        })
      } catch (e) {
        ctx.log.error({ err: e instanceof Error ? e.message : String(e) }, 'reset email failed')
      }
      // Outside production the link is also returned so the flow is testable without email.
      return { message: GENERIC_RESET_MESSAGE, devResetLink: config.isProd ? undefined : path }
    },

    async resetPassword(input: ResetPasswordInput) {
      const record = await db.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(input.token, config.SESSION_SECRET) },
      })
      if (!record || record.expiresAt.getTime() <= Date.now())
        throw badRequest('This reset link is invalid or has expired')
      const passwordHash = await hashPassword(input.password)
      // Single-use token; also revoke all sessions (a reset implies the account may be compromised).
      await db.$transaction([
        db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
        db.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
        db.session.deleteMany({ where: { userId: record.userId } }),
      ])
      return { message: 'Password updated. You can log in now.' }
    },
  }
}
