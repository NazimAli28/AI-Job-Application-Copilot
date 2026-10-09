import type { Attachment, Job } from '@copilot/shared'
import type {
  Prisma,
  JobAttachment as AttachmentRow,
  Job as JobRow,
  JobStatusHistory,
} from '../../generated/prisma/client'

/** Relations every Job read loads (history oldest first, attachments in upload order). */
export const jobInclude = {
  history: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
  attachments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.JobInclude

export type FullJobRow = JobRow & { history: JobStatusHistory[]; attachments: AttachmentRow[] }

/** Columns named after shared Zod keys (posting + tracking); `materials` is mapped separately. */
const SCALARS = [
  'title',
  'company',
  'location',
  'employmentType',
  'workType',
  'url',
  'salary',
  'description',
  'experienceYearsMin',
  'educationRequirement',
  'importedFrom',
  'status',
  'archived',
  'appliedAt',
  'applyBy',
  'nextAction',
  'nextActionAt',
  'source',
  'referral',
  'reference',
  'notes',
] as const
const LISTS = ['responsibilities', 'tags', 'interviewDates'] as const
const JSON_LISTS = ['requirements', 'contacts', 'screeningAnswers'] as const

export function toAttachment(a: AttachmentRow): Attachment {
  const out: Record<string, unknown> = { id: a.id, kind: a.kind, label: a.label }
  for (const k of ['url', 'fileName', 'fileSize', 'mimeType'] as const)
    if (a[k] !== null) out[k] = a[k]
  out.addedAt = a.createdAt.toISOString()
  return out as Attachment
}

/** Row → shared `Job` (null columns dropped: Zod optionals are `undefined`). */
export function toJob(r: FullJobRow): Job {
  const out: Record<string, unknown> = { id: r.id }
  for (const k of SCALARS) if (r[k] !== null) out[k] = r[k]
  for (const k of LISTS) out[k] = r[k]
  for (const k of JSON_LISTS) out[k] = r[k] ?? []
  out.materials = {
    ...(r.resumeId ? { resumeId: r.resumeId } : {}),
    ...(r.coverLetterId ? { coverLetterId: r.coverLetterId } : {}),
    ...(r.coverLetterText !== null ? { coverLetterText: r.coverLetterText } : {}),
    attachments: r.attachments.map(toAttachment),
  }
  out.history = r.history.map((h) => ({
    status: h.status,
    at: h.at.toISOString(),
    ...(h.note ? { note: h.note } : {}),
  }))
  out.createdAt = r.createdAt.toISOString()
  out.updatedAt = r.updatedAt.toISOString()
  return out as Job
}

/** Validated job (minus id/history/timestamps) → columns. Omitted optionals clear to NULL. */
export function toColumns(job: Omit<Job, 'id' | 'history' | 'createdAt' | 'updatedAt'>) {
  const out: Record<string, unknown> = {}
  for (const k of SCALARS) out[k] = job[k] ?? null
  for (const k of LISTS) out[k] = job[k] ?? []
  for (const k of JSON_LISTS) out[k] = (job[k] ?? []) as Prisma.InputJsonValue
  out.resumeId = job.materials.resumeId || null
  out.coverLetterId = job.materials.coverLetterId || null
  out.coverLetterText = job.materials.coverLetterText ?? null
  return out as Prisma.JobUncheckedUpdateManyInput
}
