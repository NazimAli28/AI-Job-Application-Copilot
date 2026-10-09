import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../config'
import type { Logger } from './logger'
import { createMailer } from './mailer'

const log = { info: vi.fn(), error: vi.fn() } as unknown as Logger
const mail = { to: 'a@b.co', subject: 'Hi', text: 'Body' }
const KEY = 're_' + 'x'.repeat(20)
afterEach(() => vi.unstubAllGlobals())

describe('createMailer', () => {
  it('real-looking key -> Resend with the right request', async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    const m = createMailer({ RESEND_API_KEY: KEY, MAIL_FROM: 'X <x@y.co>' }, log)
    expect(m.driver).toBe('resend')
    await m.send(mail)
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'X <x@y.co>',
      to: ['a@b.co'],
      subject: 'Hi',
      text: 'Body',
    })
  })

  it('placeholder or missing key -> console', () => {
    expect(createMailer({ RESEND_API_KEY: 're_short', MAIL_FROM: 'x' }, log).driver).toBe('console')
    expect(createMailer({ MAIL_FROM: 'x' }, log).driver).toBe('console')
  })

  it('non-2xx throws without the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 422 })),
    )
    const err = await createMailer({ RESEND_API_KEY: KEY, MAIL_FROM: 'x' }, log)
      .send(mail)
      .catch((e: Error) => e)
    expect((err as Error).message).toContain('422')
    expect((err as Error).message).not.toContain(KEY)
  })
})

describe('config s3 validation', () => {
  const base = { DATABASE_URL: 'x', SESSION_SECRET: 'x'.repeat(32), STORAGE_DRIVER: 's3' }
  it('lists missing vars', () => {
    expect(() => loadConfig({ ...base, S3_BUCKET: 'b' })).toThrow(/S3_ENDPOINT.*S3_ACCESS_KEY_ID/)
  })
  it('accepts a full config with default region', () => {
    const c = loadConfig({
      ...base,
      S3_ENDPOINT: 'https://x',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 's',
    })
    expect(c.S3_REGION).toBe('auto')
    expect(c.MAIL_FROM).toContain('onboarding@resend.dev')
  })
})
