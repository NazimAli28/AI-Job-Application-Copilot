import {
  defaultTracking,
  jobSchema,
  needsDescription,
  type ApplicationStatus,
  type JobInput,
} from '@copilot/shared'
import type { Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { badRequest, notFound } from '../../lib/errors'
import { jobInclude, toColumns, toJob } from './mapping'

const today = () => new Date().toISOString().slice(0, 10)
const editable = jobSchema.omit({ id: true, history: true, createdAt: true, updatedAt: true })
/** Changing these makes cached matches stale (tracking-only edits keep them). */
const SCORED_KEYS = [
  'title',
  'company',
  'description',
  'requirements',
  'responsibilities',
  'experienceYearsMin',
  'educationRequirement',
] as const
/** Order-insensitive: compare values that went through the same Zod parse (DB JSON key order differs). */
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Moving out of "saved" for the first time fills appliedAt (same rule as the prototype). */
const withAppliedAt = <T extends { status: ApplicationStatus; appliedAt?: string }>(v: T): T =>
  v.status !== 'saved' && !v.appliedAt ? { ...v, appliedAt: today() } : v

export function jobService(ctx: AppContext) {
  const { db, storage } = ctx

  async function load(userId: string, id: string) {
    const row = await db.job.findFirst({ where: { id, userId }, include: jobInclude })
    if (!row) throw notFound('Job')
    return row
  }

  /** The job's resume must be one of the user's own (the FK alone would accept anyone's). */
  async function assertResume(userId: string, resumeId?: string) {
    if (!resumeId) return
    if (!(await db.resume.count({ where: { id: resumeId, userId } })))
      throw badRequest('That resume no longer exists', [
        { path: ['materials', 'resumeId'], message: 'Resume not found' },
      ])
  }

  /** A sent cover letter must be the user's own letter for this job (the FK accepts any). */
  async function assertCoverLetter(userId: string, jobId: string | null, letterId?: string) {
    if (!letterId) return
    const where = { id: letterId, userId, ...(jobId ? { jobId } : {}) }
    if (!jobId || !(await db.coverLetter.count({ where })))
      throw badRequest('That cover letter no longer exists', [
        { path: ['materials', 'coverLetterId'], message: 'Cover letter not found' },
      ])
  }

  async function write(
    userId: string,
    id: string,
    data: Prisma.JobUncheckedUpdateManyInput,
    history?: { status: ApplicationStatus; note?: string },
    dropMatches = false,
  ) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.job.updateMany({ where: { id, userId }, data })
      if (!count) throw notFound('Job')
      if (history) await tx.jobStatusHistory.create({ data: { jobId: id, ...history } })
      if (dropMatches) await tx.jobMatch.deleteMany({ where: { jobId: id } })
    })
    return toJob(await load(userId, id))
  }

  return {
    async list(userId: string, includeArchived: boolean) {
      const rows = await db.job.findMany({
        where: { userId, ...(includeArchived ? {} : { archived: false }) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          ...jobInclude,
          matches: { where: { source: 'rules' }, select: { score: true } },
        },
      })
      return rows.map((r) => {
        const job = toJob(r)
        const matchScore = r.matches[0]?.score
        return {
          ...job,
          ...(matchScore !== undefined ? { matchScore } : {}),
          needsDescription: needsDescription(job),
        }
      })
    },

    async get(userId: string, id: string) {
      return toJob(await load(userId, id))
    },

    /** Posting + optional tracking; defaults via defaultTracking(); history starts at the status. */
    async create(userId: string, input: JobInput) {
      const { history: _h, ...defaults } = defaultTracking()
      const value = withAppliedAt({
        ...defaults,
        ...input,
        materials: { ...input.materials, attachments: [] }, // attachments have their own routes
      })
      await assertResume(userId, value.materials.resumeId)
      // A new job has no letters yet, so any coverLetterId is rejected.
      await assertCoverLetter(userId, null, value.materials.coverLetterId)
      const row = await db.job.create({
        data: {
          ...(toColumns(value) as Prisma.JobUncheckedCreateInput),
          userId,
          history: { create: [{ status: value.status }] },
        },
        include: jobInclude,
      })
      return toJob(row)
    },

    /**
     * PUT = partial jobInput merged onto the stored job, then re-validated. `materials` replaces
     * the stored one except attachments (server-owned). A new status appends history.
     */
    async update(userId: string, id: string, patch: Partial<JobInput>, note?: string) {
      const existing = toJob(await load(userId, id))
      const { status, materials, ...rest } = patch
      const merged = editable.safeParse({
        ...existing,
        ...rest,
        materials: materials
          ? { ...materials, attachments: existing.materials.attachments }
          : existing.materials,
      })
      if (!merged.success)
        throw badRequest('Please check the highlighted fields', merged.error.issues)
      if (merged.data.materials.resumeId !== existing.materials.resumeId)
        await assertResume(userId, merged.data.materials.resumeId)
      if (merged.data.materials.coverLetterId !== existing.materials.coverLetterId)
        await assertCoverLetter(userId, id, merged.data.materials.coverLetterId)
      const changed = status && status !== existing.status ? status : undefined
      const value = changed ? withAppliedAt({ ...merged.data, status: changed }) : merged.data
      const before = editable.parse(existing)
      const stale =
        merged.data.materials.resumeId !== existing.materials.resumeId ||
        SCORED_KEYS.some((k) => !sameJson(merged.data[k], before[k]))
      return write(userId, id, toColumns(value), changed && { status: changed, note }, stale)
    },

    setStatus(userId: string, id: string, status: ApplicationStatus, note?: string) {
      return this.update(userId, id, { status }, note)
    },

    async toggleArchive(userId: string, id: string) {
      const { archived } = await load(userId, id)
      return write(userId, id, { archived: !archived })
    },

    /** Deletes the job (history/attachments cascade; resumes keep existing, unlinked) + files. */
    async remove(userId: string, id: string) {
      const files = await db.jobAttachment.findMany({
        where: { jobId: id, userId, storageKey: { not: null } },
        select: { storageKey: true },
      })
      const { count } = await db.job.deleteMany({ where: { id, userId } })
      if (!count) throw notFound('Job')
      await Promise.all(
        files.map(({ storageKey }) =>
          storage.remove(storageKey!).catch((err: unknown) => {
            ctx.log.warn({ err, storageKey }, 'attachment file delete failed')
          }),
        ),
      )
    },

    load,
  }
}
