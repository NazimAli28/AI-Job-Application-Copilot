/**
 * Template for user-owned tables (plan.md: "userId-scoped repo"). Every query filters by userId,
 * so another user's row id behaves exactly like a missing one → 404 (no existence leak).
 * Columns are named after the shared Zod keys, so rows map to the API shape generically.
 */
import type { z } from 'zod'
import { badRequest, conflict, isUniqueViolation, notFound } from './errors'

type Row = Record<string, unknown>
type Shape = z.ZodObject<z.ZodRawShape>

/** Structural slice of a Prisma model delegate — all user-owned models satisfy it. */
export type OwnedDelegate = {
  findMany(args: object): Promise<Row[]>
  findFirst(args: object): Promise<Row | null>
  create(args: object): Promise<Row>
  updateMany(args: object): Promise<{ count: number }>
  deleteMany(args: object): Promise<{ count: number }>
}

/** DB row → API object: only schema keys, `null` columns dropped (Zod optionals are `undefined`). */
export function toApi<S extends Shape>(schema: S, row: Row): z.infer<S> {
  const out: Row = {}
  for (const key of Object.keys(schema.shape))
    if (row[key] !== null && row[key] !== undefined) out[key] = row[key]
  return out as z.infer<S>
}

/** API object → columns. Every schema key is written, so omitted optionals clear to NULL. */
export function toColumns<S extends Shape>(schema: S, value: Row): Row {
  const out: Row = {}
  for (const key of Object.keys(schema.shape)) if (key !== 'id') out[key] = value[key] ?? null
  return out
}

type Options<S extends Shape> = {
  delegate: OwnedDelegate
  schema: S
  label: string
  /** Extra derived columns (e.g. a normalized unique key). */
  derive?: (value: z.infer<S>) => Row
  /** Message for a unique-constraint clash; omit when the table has no user-level unique key. */
  conflictMessage?: (value: z.infer<S>) => string
}

export function ownedCollection<S extends Shape>(opts: Options<S>) {
  const { delegate, schema, label } = opts
  const createSchema = schema.omit({ id: true })
  const patchSchema = createSchema.partial()
  const columns = (v: z.infer<S>) => ({ ...toColumns(schema, v), ...opts.derive?.(v) })
  const onClash = (v: z.infer<S>) => (e: unknown) => {
    if (opts.conflictMessage && isUniqueViolation(e)) throw conflict(opts.conflictMessage(v))
    throw e
  }
  const find = async (userId: string, id: string) => {
    const row = await delegate.findFirst({ where: { id, userId } })
    if (!row) throw notFound(label)
    return row
  }

  return {
    createSchema,
    patchSchema,

    async list(userId: string) {
      const rows = await delegate.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      return rows.map((r) => toApi(schema, r))
    },

    async create(userId: string, input: Row) {
      const value = input as z.infer<S>
      const row = await delegate
        .create({ data: { ...columns(value), userId } })
        .catch(onClash(value))
      return toApi(schema, row)
    },

    /** PATCH = merge onto the stored row, then re-validate the whole object. */
    async update(userId: string, id: string, patch: Row) {
      const existing = toApi(schema, await find(userId, id))
      const merged = schema.safeParse({ ...existing, ...patch, id })
      if (!merged.success)
        throw badRequest('Please check the highlighted fields', merged.error.issues)
      const { count } = await delegate
        .updateMany({ where: { id, userId }, data: columns(merged.data) })
        .catch(onClash(merged.data))
      if (!count) throw notFound(label) // deleted concurrently
      return merged.data
    },

    async remove(userId: string, id: string) {
      const { count } = await delegate.deleteMany({ where: { id, userId } })
      if (!count) throw notFound(label)
    },
  }
}
