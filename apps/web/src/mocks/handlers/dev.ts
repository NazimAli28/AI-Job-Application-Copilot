import { http } from 'msw'
import { db } from '../db'
import { auth, ok } from '../utils'

/** Prototype-only endpoints for the dev toolbar (tier preview, reset). Not part of the real API. */
export const devHandlers = [
  http.post('/api/dev/tier', async ({ request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const body = (await request.json()) as { aiAccess?: boolean; role?: 'user' | 'admin' }
    db.write((s) => {
      const u = s.users.find((x) => x.id === a.user.id)
      if (!u) return
      if (body.aiAccess !== undefined) u.aiAccess = body.aiAccess
      if (body.role) u.role = body.role
    })
    return ok(null)
  }),
  http.post('/api/dev/reset', () => {
    db.reset()
    return ok(null)
  }),
]
