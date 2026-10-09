import supertest from 'supertest'
import { inject } from 'vitest'
import { createApp } from '../app'
import type { AppContext } from '../context'
import { loadConfig } from '../config'
import { createDb } from '../lib/db'
import { createLogger } from '../lib/logger'
import type { Mail } from '../lib/mailer'
import { memoryStorage } from '../lib/storage'

export const WEB_ORIGIN = 'http://localhost:5173'

/** Fresh app wired to the shared test database; captures sent mail. */
export function testApp(
  env: Record<string, string> = {},
  extra: Pick<AppContext, 'httpFetch' | 'aiProvider' | 'aiBackup'> = {},
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    SESSION_SECRET: 'test-secret-test-secret-test-secret-123',
    APP_URL: WEB_ORIGIN,
    ADMIN_EMAILS: 'boss@example.com',
    LOG_LEVEL: 'silent',
    ...env,
  })
  const db = createDb(config.DATABASE_URL, { max: 2 })
  const mail: Mail[] = []
  const storage = memoryStorage()
  const app = createApp({
    config,
    db,
    log: createLogger('silent', false),
    mailer: { send: async (m) => void mail.push(m) },
    storage,
    ...extra,
  })
  return { app, db, config, mail, storage, request: () => supertest.agent(app) }
}

export async function resetDb(db: ReturnType<typeof createDb>) {
  await db.$executeRawUnsafe(
    'TRUNCATE "PasswordResetToken", "Session", "User" RESTART IDENTITY CASCADE',
  )
}

export const alice = { name: 'Alice Doe', email: 'alice@example.com', password: 'password123' }
