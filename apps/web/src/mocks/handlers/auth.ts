import { http } from 'msw'
import {
  ERROR_CODES,
  accessRequestInput,
  forgotPasswordInput,
  loginInput,
  registerInput,
  resetPasswordInput,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, fakeHash, type StoredUser } from '../db'
import { ensureDemoUser } from '../seed/demo'
import { auth, fail, latency, now, ok, parseBody, publicUser } from '../utils'

const ADMIN_EMAILS = ['nazimalionline@gmail.com', 'admin@demo.dev']

export const authHandlers = [
  http.get('/api/auth/me', async () => {
    await latency(150)
    const a = auth()
    return a instanceof Response ? a : ok(publicUser(a.user))
  }),

  http.post('/api/auth/register', async ({ request }) => {
    await latency()
    const body = await parseBody(request, registerInput)
    if (!body.ok) return body.response
    const email = body.value.email.toLowerCase()
    if (db.read().users.some((u) => u.email === email))
      return fail(409, ERROR_CODES.CONFLICT, 'An account with this email already exists')
    const user = db.write((s) => {
      const u: StoredUser = {
        id: uid('usr'),
        email,
        name: body.value.name,
        role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user',
        aiAccess: false,
        isDemo: false,
        createdAt: now(),
        passwordHash: fakeHash(body.value.password),
      }
      s.users.push(u)
      s.sessionUserId = u.id
      return u
    })
    return ok(publicUser(user), 201)
  }),

  http.post('/api/auth/login', async ({ request }) => {
    await latency()
    const body = await parseBody(request, loginInput)
    if (!body.ok) return body.response
    const user = db.read().users.find((u) => u.email === body.value.email.toLowerCase())
    // Same message for unknown email and wrong password (no account enumeration).
    if (!user || user.isDemo || user.passwordHash !== fakeHash(body.value.password))
      return fail(401, ERROR_CODES.UNAUTHENTICATED, 'Incorrect email or password')
    db.write((s) => void (s.sessionUserId = user.id))
    return ok(publicUser(user))
  }),

  http.post('/api/auth/demo', async () => {
    await latency(500)
    const user = ensureDemoUser()
    db.write((s) => void (s.sessionUserId = user.id))
    return ok(publicUser(user))
  }),

  http.post('/api/auth/logout', async () => {
    await latency(100)
    db.write((s) => void (s.sessionUserId = null))
    return ok(null)
  }),

  http.post('/api/auth/forgot-password', async ({ request }) => {
    await latency()
    const body = await parseBody(request, forgotPasswordInput)
    if (!body.ok) return body.response
    const email = body.value.email.toLowerCase()
    const user = db.read().users.find((u) => u.email === email && !u.isDemo)
    let devResetLink: string | undefined
    if (user) {
      const token = uid('rst')
      db.write((s) => {
        s.resetTokens.push({ token, userId: user.id, expiresAt: Date.now() + 30 * 60_000 })
      })
      // The real API emails this link via Resend. The prototype returns it so the flow is testable.
      devResetLink = `/reset-password?token=${token}`
    }
    // Always the same message (no account enumeration).
    return ok({ message: 'If that email exists, a reset link has been sent.', devResetLink })
  }),

  http.post('/api/auth/reset-password', async ({ request }) => {
    await latency()
    const body = await parseBody(request, resetPasswordInput)
    if (!body.ok) return body.response
    const t = db.read().resetTokens.find((r) => r.token === body.value.token)
    if (!t || t.expiresAt < Date.now())
      return fail(400, ERROR_CODES.VALIDATION, 'This reset link is invalid or has expired')
    db.write((s) => {
      const u = s.users.find((x) => x.id === t.userId)
      if (u) u.passwordHash = fakeHash(body.value.password)
      s.resetTokens = s.resetTokens.filter((r) => r.userId !== t.userId)
    })
    return ok({ message: 'Password updated. You can log in now.' })
  }),

  // ---- AI Pro quota (demo/offline: simulated engine, nothing counted) ----
  http.get('/api/ai/usage', async () => {
    await latency(100)
    const a = auth()
    if (a instanceof Response) return a
    const tomorrow = new Date()
    tomorrow.setUTCHours(24, 0, 0, 0)
    return ok({ provider: 'simulated', usedToday: 0, dailyLimit: 40, resetsAt: tomorrow.toISOString() })
  }),

  // ---- AI access requests (invite-only AI Pro) ----
  http.get('/api/access-requests/mine', async () => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    return ok(db.read().accessRequests.find((r) => r.userId === a.user.id) ?? null)
  }),

  http.post('/api/access-requests', async ({ request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    if (a.user.isDemo)
      return fail(403, ERROR_CODES.DEMO_READ_ONLY, 'Create a free account to request AI access')
    const body = await parseBody(request, accessRequestInput)
    if (!body.ok) return body.response
    const req = db.write((s) => {
      s.accessRequests = s.accessRequests.filter((r) => r.userId !== a.user.id)
      const r = {
        id: uid('acr'),
        userId: a.user.id,
        email: a.user.email,
        name: a.user.name,
        reason: body.value.reason,
        status: 'pending' as const,
        createdAt: now(),
      }
      s.accessRequests.push(r)
      return r
    })
    return ok(req, 201)
  }),

  // ---- Admin (ADMIN_EMAILS only) ----
  http.get('/api/admin/access-requests', async () => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    if (a.user.role !== 'admin') return fail(403, ERROR_CODES.FORBIDDEN, 'Admins only')
    return ok([...db.read().accessRequests].sort((x, y) => y.createdAt.localeCompare(x.createdAt)))
  }),

  http.post('/api/admin/access-requests/:id/:decision', async ({ params }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    if (a.user.role !== 'admin') return fail(403, ERROR_CODES.FORBIDDEN, 'Admins only')
    const decision = params.decision === 'approve' ? 'approved' : 'denied'
    const updated = db.write((s) => {
      const r = s.accessRequests.find((x) => x.id === params.id)
      if (!r) return null
      r.status = decision
      const u = s.users.find((x) => x.id === r.userId)
      if (u) u.aiAccess = decision === 'approved'
      return r
    })
    return updated ? ok(updated) : fail(404, ERROR_CODES.NOT_FOUND, 'Request not found')
  }),
]
