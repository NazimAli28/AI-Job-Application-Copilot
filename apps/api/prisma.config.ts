import { defineConfig } from 'prisma/config'

// DATABASE_URL comes from apps/api/.env (loaded by `node --env-file`) or the host's env vars.
try {
  process.loadEnvFile('.env')
} catch {
  // no .env file (CI / production) — use the real environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // CLI only (migrate/studio): Neon's direct (non-pooled) URL when set — the app itself uses
  // DATABASE_URL (pooled) through the pg adapter.
  datasource: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '' },
})
