/**
 * Vercel serverless entry (D24): the same Express app as server.ts, without `listen`. Bundled by
 * scripts/build-vercel.mjs into one function that serves every `/api/*` route of the web project.
 * Module scope runs once per warm instance, so config, DB pool and providers are reused.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createAiProvider, createBackupProvider } from './ai/provider'
import { createApp } from './app'
import { loadConfig } from './config'
import { createDb } from './lib/db'
import { createLogger } from './lib/logger'
import { createMailer } from './lib/mailer'
import { createStorage } from './lib/storage'

// Vercel defaults: one proxy (Vercel's edge) in front; the filesystem is read-only, so files go to
// S3-compatible storage (a missing S3_* variable fails loudly at startup).
process.env.TRUST_PROXY ??= '1'
process.env.STORAGE_DRIVER ??= 's3'
// Allowed web origin(s) = this deployment's own URLs (production first: it is used in emails).
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter(Boolean)
  .map((host) => `https://${host}`)
  .join(',')
if (vercelOrigins) process.env.APP_URL ??= vercelOrigins
const config = loadConfig()
const log = createLogger(config.LOG_LEVEL, false)
const app = createApp({
  config,
  // Few connections per instance: many instances may run at once against Neon's pooler.
  db: createDb(config.DATABASE_URL, { max: 3 }),
  log,
  mailer: createMailer(config, log),
  storage: createStorage(config),
  aiProvider: createAiProvider(config),
  aiBackup: createBackupProvider(config),
})

/**
 * The route `/api/(.*)` → `/api?__path=$1` hands us the original path in `__path`; restore it
 * so Express routes as usual (and keep any other query parameters).
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://local')
  const path = url.searchParams.get('__path')
  if (path !== null) {
    url.searchParams.delete('__path')
    const query = url.searchParams.toString()
    req.url = `/api/${path}${query ? `?${query}` : ''}`
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1])
}
