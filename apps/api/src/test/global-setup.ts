import type { TestProject } from 'vitest/node'
import { startPglite } from '../../scripts/pglite'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

/** In-memory Postgres for the whole run — no Neon/Docker needed in tests or CI. */
export default async function setup(project: TestProject) {
  const db = await startPglite({ port: 54329 })
  project.provide('databaseUrl', db.url)
  return () => db.stop()
}
