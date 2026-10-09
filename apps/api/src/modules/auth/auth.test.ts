import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { hashToken } from '../../lib/tokens'
import { WEB_ORIGIN, alice, resetDb, testApp } from '../../test/helpers'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

const register = (agent = t.request(), body = alice) => agent.post('/api/auth/register').send(body)

describe('health & plumbing', () => {
  it('reports ok with the database reachable', async () => {
    const res = await t.request().get('/api/health').expect(200)
    expect(res.body).toEqual({ data: { status: 'ok' } })
  })

  it('returns the error envelope for unknown routes and malformed JSON', async () => {
    const r1 = await t.request().get('/api/nope').expect(404)
    expect(r1.body.error.code).toBe('NOT_FOUND')
    const r2 = await t
      .request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400)
    expect(r2.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('sets security headers', async () => {
    const res = await t.request().get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('register', () => {
  it('creates a user, logs them in with an httpOnly cookie, never leaks the hash', async () => {
    const agent = t.request()
    const res = await register(agent).expect(201)
    expect(res.body.data).toMatchObject({
      email: alice.email,
      name: alice.name,
      role: 'user',
      aiAccess: false,
      isDemo: false,
    })
    expect(res.body.data.passwordHash).toBeUndefined()
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/sid=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)

    const me = await agent.get('/api/auth/me').expect(200)
    expect(me.body.data.email).toBe(alice.email)

    const row = await t.db.user.findUniqueOrThrow({ where: { email: alice.email } })
    expect(row.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('stores only a keyed hash of the session token', async () => {
    const res = await register().expect(201)
    const token = /sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!
    const sessions = await t.db.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.tokenHash).toBe(hashToken(token, t.config.SESSION_SECRET))
    expect(sessions[0]!.tokenHash).not.toContain(token)
  })

  it('rejects duplicate emails case-insensitively', async () => {
    await register().expect(201)
    const res = await register(t.request(), { ...alice, email: 'ALICE@example.com' }).expect(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })

  it('validates input with the shared schema', async () => {
    const res = await register(t.request(), { ...alice, password: 'short' }).expect(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details[0].path).toEqual(['password'])
  })

  it('makes ADMIN_EMAILS admins', async () => {
    const res = await register(t.request(), { ...alice, email: 'boss@example.com' }).expect(201)
    expect(res.body.data.role).toBe('admin')
  })
})

describe('login / logout / me', () => {
  it('requires a session for /me', async () => {
    const res = await t.request().get('/api/auth/me').expect(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('logs in, logs out and revokes the session server-side', async () => {
    await register().expect(201)
    const agent = t.request()
    await agent
      .post('/api/auth/login')
      .send({ email: 'Alice@Example.com', password: alice.password })
      .expect(200)
    await agent.get('/api/auth/me').expect(200)
    await agent.post('/api/auth/logout').expect(200)
    await agent.get('/api/auth/me').expect(401)
    expect(await t.db.session.count()).toBe(1) // only the registration session remains
  })

  it('does not reveal whether an email exists', async () => {
    await register().expect(201)
    const wrongPw = await t
      .request()
      .post('/api/auth/login')
      .send({ email: alice.email, password: 'nope12345' })
      .expect(401)
    const noUser = await t
      .request()
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'nope12345' })
      .expect(401)
    expect(wrongPw.body).toEqual(noUser.body)
  })

  it('rejects a replayed cookie after logout', async () => {
    const res = await register().expect(201)
    const cookie = String(res.headers['set-cookie']).split(';')[0]!
    await t.request().post('/api/auth/logout').set('Cookie', cookie).expect(200)
    await t.request().get('/api/auth/me').set('Cookie', cookie).expect(401)
  })

  it('rejects expired sessions', async () => {
    const agent = t.request()
    await register(agent).expect(201)
    await t.db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    await agent.get('/api/auth/me').expect(401)
    expect(await t.db.session.count()).toBe(0)
  })

  it('blocks cross-site writes by Origin', async () => {
    const res = await t
      .request()
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: alice.email, password: alice.password })
      .expect(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    await t.request().post('/api/auth/demo').set('Origin', WEB_ORIGIN).expect(200)
  })
})

describe('demo account', () => {
  it('logs into the read-only demo user, which cannot password-login', async () => {
    const agent = t.request()
    const res = await agent.post('/api/auth/demo').expect(200)
    expect(res.body.data).toMatchObject({ email: 'demo@demo.dev', isDemo: true, aiAccess: true })
    await agent.get('/api/auth/me').expect(200)
    await t.request().post('/api/auth/demo').expect(200)
    expect(await t.db.user.count()).toBe(1)
    await t
      .request()
      .post('/api/auth/login')
      .send({ email: 'demo@demo.dev', password: 'anything1' })
      .expect(401)
  })
})

describe('password reset', () => {
  const linkToken = (link: string) => new URL(link, 'http://x').searchParams.get('token')!

  it('emails a single-use link, resets the password and revokes sessions', async () => {
    const agent = t.request()
    await register(agent).expect(201)
    const res = await t
      .request()
      .post('/api/auth/forgot-password')
      .send({ email: alice.email })
      .expect(200)
    expect(t.mail).toHaveLength(1)
    expect(t.mail[0]!.text).toContain(`${WEB_ORIGIN}${res.body.data.devResetLink}`)
    const token = linkToken(res.body.data.devResetLink)

    await t
      .request()
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpass123' })
      .expect(200)
    await agent.get('/api/auth/me').expect(401) // old session revoked
    await t
      .request()
      .post('/api/auth/reset-password')
      .send({ token, password: 'again12345' })
      .expect(400)
    await t
      .request()
      .post('/api/auth/login')
      .send({ email: alice.email, password: alice.password })
      .expect(401)
    await t
      .request()
      .post('/api/auth/login')
      .send({ email: alice.email, password: 'newpass123' })
      .expect(200)
  })

  it('answers identically for unknown emails and sends nothing', async () => {
    const before = t.mail.length
    const res = await t
      .request()
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' })
      .expect(200)
    expect(res.body.data).toEqual({ message: 'If that email exists, a reset link has been sent.' })
    expect(t.mail.length).toBe(before)
  })

  it('rejects expired tokens', async () => {
    await register().expect(201)
    const res = await t.request().post('/api/auth/forgot-password').send({ email: alice.email })
    await t.db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } })
    await t
      .request()
      .post('/api/auth/reset-password')
      .send({ token: linkToken(res.body.data.devResetLink), password: 'newpass123' })
      .expect(400)
  })

  it('hides the dev link in production', async () => {
    const prod = testApp({ NODE_ENV: 'production' })
    await register(prod.request()).expect(201)
    const res = await prod
      .request()
      .post('/api/auth/forgot-password')
      .send({ email: alice.email })
      .expect(200)
    expect(res.body.data.devResetLink).toBeUndefined()
    await prod.db.$disconnect()
  })
})
