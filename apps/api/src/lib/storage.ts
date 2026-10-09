import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { AwsClient } from 'aws4fetch'

/**
 * Object storage for uploaded files (resumes). Keys are generated server-side
 * (`resumes/<userId>/<id>.pdf`). Drivers: `local` disk (dev), `memory` (tests);
 * `s3` (R2 / Supabase Storage) for production — serverless disks are read-only/ephemeral.
 */
export interface StorageService {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  /** null when the object is missing. */
  get(key: string): Promise<Uint8Array | null>
  /** No-op when missing. */
  remove(key: string): Promise<void>
}

const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/

function assertKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`)
}

export function memoryStorage(): StorageService {
  const objects = new Map<string, Uint8Array>()
  return {
    async put(key, bytes) {
      assertKey(key)
      objects.set(key, new Uint8Array(bytes))
    },
    async get(key) {
      return objects.get(key) ?? null
    },
    async remove(key) {
      objects.delete(key)
    },
  }
}

export function diskStorage(rootDir: string): StorageService {
  const root = resolve(rootDir)
  const pathOf = (key: string) => {
    assertKey(key)
    const p = resolve(root, key)
    // Defense in depth: the key regex already forbids `..`.
    if (!p.startsWith(root + sep)) throw new Error(`Invalid storage key: ${key}`)
    return p
  }
  return {
    async put(key, bytes) {
      const p = pathOf(key)
      await mkdir(dirname(p), { recursive: true })
      await writeFile(p, bytes)
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathOf(key)))
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw e
      }
    },
    async remove(key) {
      await rm(pathOf(key), { force: true })
    },
  }
}

export type S3Options = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
}

/** S3-compatible driver (Cloudflare R2, Supabase Storage S3 endpoint). Path-style URLs. */
export function s3Storage(opts: S3Options): StorageService {
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    service: 's3',
    region: opts.region ?? 'auto',
    retries: 2, // retries 5xx/network errors with backoff (default of 10 is too long for a request)
  })
  const base = `${opts.endpoint.replace(/\/+$/, '')}/${opts.bucket}`
  const urlOf = (key: string) => {
    assertKey(key)
    return `${base}/${key}`
  }
  const fail = (op: string, res: Response) =>
    new Error(`Storage ${op} failed with status ${res.status}`)
  return {
    async put(key, bytes, contentType) {
      const res = await client.fetch(urlOf(key), {
        method: 'PUT',
        body: bytes,
        headers: { 'content-type': contentType },
      })
      if (!res.ok) throw fail('put', res)
    },
    async get(key) {
      const res = await client.fetch(urlOf(key), { method: 'GET' })
      if (res.status === 404) return null
      if (!res.ok) throw fail('get', res)
      return new Uint8Array(await res.arrayBuffer())
    },
    async remove(key) {
      const res = await client.fetch(urlOf(key), { method: 'DELETE' })
      if (res.status === 404 || res.ok) return
      throw fail('remove', res)
    },
  }
}

export type StorageConfig = {
  STORAGE_DRIVER: 'local' | 'memory' | 's3'
  STORAGE_DIR: string
  S3_ENDPOINT?: string
  S3_BUCKET?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_REGION?: string
}

export function createStorage(cfg: StorageConfig): StorageService {
  if (cfg.STORAGE_DRIVER === 'memory') return memoryStorage()
  if (cfg.STORAGE_DRIVER === 's3') {
    if (!cfg.S3_ENDPOINT || !cfg.S3_BUCKET || !cfg.S3_ACCESS_KEY_ID || !cfg.S3_SECRET_ACCESS_KEY)
      throw new Error(
        's3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY',
      )
    return s3Storage({
      endpoint: cfg.S3_ENDPOINT,
      bucket: cfg.S3_BUCKET,
      accessKeyId: cfg.S3_ACCESS_KEY_ID,
      secretAccessKey: cfg.S3_SECRET_ACCESS_KEY,
      region: cfg.S3_REGION,
    })
  }
  return diskStorage(cfg.STORAGE_DIR)
}
