import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { alice, resetDb, testApp } from '../../test/helpers'

const t = testApp()
afterAll(() => t.db.$disconnect())
beforeEach(() => resetDb(t.db))

// ADMIN_EMAILS=boss@example.com in testApp()
const boss = { name: 'The Boss', email: 'boss@example.com', password: 'password123' }
const reason = 'I want tailored cover letters for my applications'

async function signedIn(body = alice) {
  const agent = t.request()
  await agent.post('/api/auth/register').send(body).expect(201)
  return agent
}

describe('access requests', () => {
  it('lets a user request AI Pro once (re-request replaces) and read it back', async () => {
    const a = await signedIn()
    expect((await a.get('/api/access-requests/mine').expect(200)).body.data).toBeNull()
    await a.post('/api/access-requests').send({ reason: 'short' }).expect(400)
    await a.post('/api/access-requests').send({ reason }).expect(201)
    const res = await a
      .post('/api/access-requests')
      .send({ reason: `${reason}!` })
      .expect(201)
    expect(res.body.data).toMatchObject({
      email: alice.email,
      name: alice.name,
      reason: `${reason}!`,
      status: 'pending',
    })
    expect(await t.db.accessRequest.count()).toBe(1)
  })

  it('blocks the demo account', async () => {
    const d = t.request()
    await d.post('/api/auth/demo').expect(200)
    const res = await d.post('/api/access-requests').send({ reason }).expect(403)
    expect(res.body.error.code).toBe('DEMO_READ_ONLY')
  })
})

describe('admin', () => {
  it('approve grants aiAccess; deny revokes it', async () => {
    const a = await signedIn()
    const admin = await signedIn(boss)
    const { body } = await a.post('/api/access-requests').send({ reason }).expect(201)
    const id = body.data.id

    const list = await admin.get('/api/admin/access-requests').expect(200)
    expect(list.body.data).toHaveLength(1)

    const approved = await admin.post(`/api/admin/access-requests/${id}/approve`).expect(200)
    expect(approved.body.data.status).toBe('approved')
    expect((await a.get('/api/auth/me')).body.data.aiAccess).toBe(true)
    // Already has AI Pro → asking again is a conflict.
    await a.post('/api/access-requests').send({ reason }).expect(409)

    await admin.post(`/api/admin/access-requests/${id}/deny`).expect(200)
    expect((await a.get('/api/auth/me')).body.data.aiAccess).toBe(false)
    expect((await a.get('/api/access-requests/mine')).body.data.status).toBe('denied')
  })

  it('is admins-only and 404s unknown requests/decisions', async () => {
    const a = await signedIn()
    const admin = await signedIn(boss)
    await t.request().get('/api/admin/access-requests').expect(401)
    const res = await a.get('/api/admin/access-requests').expect(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    const { body } = await a.post('/api/access-requests').send({ reason }).expect(201)
    await a.post(`/api/admin/access-requests/${body.data.id}/approve`).expect(403)
    await admin.post('/api/admin/access-requests/nope/approve').expect(404)
    await admin.post(`/api/admin/access-requests/${body.data.id}/maybe`).expect(404)
  })
})

describe('dev tier toolbar route', () => {
  it('switches tier outside production and does not exist in production', async () => {
    const a = await signedIn()
    await a.post('/api/dev/tier').send({ aiAccess: true, role: 'admin' }).expect(200)
    expect((await a.get('/api/auth/me')).body.data).toMatchObject({ aiAccess: true, role: 'admin' })

    const prod = testApp({ NODE_ENV: 'production' })
    try {
      await prod.request().post('/api/dev/tier').send({ aiAccess: true }).expect(404)
    } finally {
      await prod.db.$disconnect()
    }
  })
})
