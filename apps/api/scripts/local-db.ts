/** `pnpm db:local` — persistent embedded Postgres on :5433 (data in apps/api/.pglite). */
import { fileURLToPath } from 'node:url'
import { startPglite } from './pglite'

const port = Number(process.env.LOCAL_DB_PORT ?? 5433)
const dataDir = fileURLToPath(new URL('../.pglite', import.meta.url))

const db = await startPglite({ port, dataDir })
console.log(`Local Postgres (PGlite) ready: ${db.url}`)
if (db.applied.length) console.log(`Applied migrations: ${db.applied.join(', ')}`)
console.log('Set DATABASE_URL to this in apps/api/.env. Ctrl+C to stop.')

const stop = async () => {
  await db.stop()
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
