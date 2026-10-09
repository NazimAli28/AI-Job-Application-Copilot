import type { AiProvider } from './ai/provider'
import type { Config } from './config'
import type { Db } from './lib/db'
import type { Logger } from './lib/logger'
import type { Mailer } from './lib/mailer'
import type { HttpFetch } from './lib/safe-fetch'
import type { StorageService } from './lib/storage'

/** Dependencies injected into the app factory (tests pass their own). */
export type AppContext = {
  config: Config
  db: Db
  log: Logger
  mailer: Mailer
  storage: StorageService
  /** Outbound fetch for user-supplied URLs (default: SSRF-guarded `safeFetch`). */
  httpFetch?: HttpFetch
  /** Claude (AI Pro). null/omitted → simulated engine (no key configured, tests). */
  aiProvider?: AiProvider | null
  /** Free endpoint tried when Claude fails or hits the monthly budget (config.ai.backup). */
  aiBackup?: AiProvider | null
}
