import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStorage, s3Storage } from './storage'

const opts = {
  endpoint: 'https://acct.r2.cloudflarestorage.com/',
  bucket: 'bkt',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secretsecretsecret',
}
const KEY = 'resumes/u1/abc.pdf'

function stub(status: number, body: ConstructorParameters<typeof Response>[0] = null) {
  const fn = vi.fn(async (_req: Request) => new Response(body, { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}
afterEach(() => vi.unstubAllGlobals())

describe('s3Storage', () => {
  it('PUTs signed to a path-style URL', async () => {
    const f = stub(200)
    await s3Storage(opts).put(KEY, new Uint8Array([1, 2]), 'application/pdf')
    const req = f.mock.calls[0]![0]
    expect(req.method).toBe('PUT')
    expect(req.url).toBe(`https://acct.r2.cloudflarestorage.com/bkt/${KEY}`)
    expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /)
    expect(req.headers.get('content-type')).toBe('application/pdf')
  })

  it('GET returns bytes, 404 -> null, other errors throw without secrets', async () => {
    stub(200, new Uint8Array([7, 8]))
    expect(await s3Storage(opts).get(KEY)).toEqual(new Uint8Array([7, 8]))
    stub(404)
    expect(await s3Storage(opts).get(KEY)).toBeNull()
    stub(500)
    const err = await s3Storage(opts)
      .get(KEY)
      .catch((e: Error) => e)
    expect((err as Error).message).toContain('500')
    expect((err as Error).message).not.toContain(opts.secretAccessKey)
  })

  it('DELETE is idempotent and throws on errors', async () => {
    const f = stub(404)
    await expect(s3Storage(opts).remove(KEY)).resolves.toBeUndefined()
    expect(f.mock.calls[0]![0].method).toBe('DELETE')
    stub(204)
    await expect(s3Storage(opts).remove(KEY)).resolves.toBeUndefined()
    stub(403)
    await expect(s3Storage(opts).remove(KEY)).rejects.toThrow('403')
  })

  it('rejects unsafe keys', async () => {
    await expect(s3Storage(opts).get('../x.pdf')).rejects.toThrow('Invalid storage key')
  })
})

describe('createStorage', () => {
  it('picks s3 and validates its config', () => {
    const base = { STORAGE_DRIVER: 's3' as const, STORAGE_DIR: '.s' }
    expect(() => createStorage(base)).toThrow('S3_ENDPOINT')
    expect(
      createStorage({
        ...base,
        S3_ENDPOINT: 'https://x',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 's',
      }),
    ).toBeTruthy()
    expect(createStorage({ STORAGE_DRIVER: 'memory', STORAGE_DIR: '.s' })).toBeTruthy()
  })
})
