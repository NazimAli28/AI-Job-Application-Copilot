/**
 * Embedded Postgres (PGlite, WASM) exposed over TCP — used by the test suite and by `pnpm db:local`
 * as a zero-install fallback when no Neon dev branch is configured (D13). Not used in production.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const MIGRATIONS = fileURLToPath(new URL('../prisma/migrations', import.meta.url))

/** Applies prisma/migrations/*\/migration.sql in order, tracking applied ones in `_local_migrations`. */
export async function applyMigrations(db: PGlite) {
  await db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)')
  const done = new Set(
    (await db.query<{ name: string }>('SELECT name FROM _local_migrations')).rows.map(
      (r) => r.name,
    ),
  )
  const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const applied: string[] = []
  for (const name of dirs) {
    if (done.has(name)) continue
    await db.exec(readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8'))
    await db.query('INSERT INTO _local_migrations (name) VALUES ($1)', [name])
    applied.push(name)
  }
  return applied
}

export async function startPglite(opts: { port: number; dataDir?: string }) {
  const db = await PGlite.create(opts.dataDir)
  const applied = await applyMigrations(db)
  const server = new PGLiteSocketServer({
    db,
    port: opts.port,
    host: '127.0.0.1',
    maxConnections: 20, // queued onto PGlite's single connection
  })
  await server.start()
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${opts.port}/postgres?sslmode=disable`,
    applied,
    async stop() {
      await server.stop()
      await db.close()
    },
  }
}
