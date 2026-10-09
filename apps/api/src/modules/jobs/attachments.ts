import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { AppError, badRequest, notFound } from '../../lib/errors'
import { jobService } from './service'
import { toJob } from './mapping'

/**
 * "What I sent" attachments (D9). Files are stored via StorageService under
 * `attachments/<userId>/<id>.<ext>`; only document/image types, always served as a download.
 */
export const MAX_ATTACHMENTS = 20

/** Extension → served Content-Type (never the client-declared type). */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? ''
const cleanFileName = (name: string) => name.replace(/[^\w .()-]/g, '_').slice(0, 120) || 'file'

export function attachmentService(ctx: AppContext) {
  const { db, storage } = ctx
  const jobs = jobService(ctx)

  async function ownedJob(userId: string, jobId: string) {
    const job = await jobs.load(userId, jobId)
    if (job.attachments.length >= MAX_ATTACHMENTS)
      throw new AppError(409, 'CONFLICT', `A job can have at most ${MAX_ATTACHMENTS} attachments`)
    return job
  }

  type NewAttachment = Omit<Prisma.JobAttachmentUncheckedCreateInput, 'userId' | 'jobId'>

  async function insert(userId: string, jobId: string, data: NewAttachment) {
    await db.$transaction([
      db.jobAttachment.create({ data: { ...data, userId, jobId } }),
      db.job.update({ where: { id: jobId }, data: { updatedAt: new Date() } }),
    ])
    return toJob(await jobs.load(userId, jobId))
  }

  return {
    async addFile(
      userId: string,
      jobId: string,
      input: { bytes: Uint8Array; fileName: string; label?: string },
    ) {
      await ownedJob(userId, jobId)
      if (input.bytes.byteLength === 0) throw badRequest('That file is empty')
      const ext = extOf(input.fileName)
      const mimeType = ATTACHMENT_TYPES[ext]
      if (!mimeType)
        throw badRequest('Attach a PDF, Word, text or image file (or add a link instead)')
      const id = randomUUID()
      const storageKey = `attachments/${userId}/${id}.${ext}`
      const fileName = cleanFileName(input.fileName)
      await storage.put(storageKey, input.bytes, mimeType)
      try {
        return await insert(userId, jobId, {
          id,
          kind: 'file',
          label: input.label || fileName,
          fileName,
          fileSize: input.bytes.byteLength,
          mimeType,
          storageKey,
        })
      } catch (e) {
        await storage.remove(storageKey)
        throw e
      }
    },

    async addLink(userId: string, jobId: string, input: { label: string; url: string }) {
      await ownedJob(userId, jobId)
      return insert(userId, jobId, { kind: 'link', label: input.label, url: input.url })
    },

    async remove(userId: string, jobId: string, aid: string) {
      await jobs.load(userId, jobId)
      const att = await db.jobAttachment.findFirst({ where: { id: aid, jobId, userId } })
      if (!att) throw notFound('Attachment')
      await db.$transaction([
        db.jobAttachment.delete({ where: { id: aid } }),
        db.job.update({ where: { id: jobId }, data: { updatedAt: new Date() } }),
      ])
      if (att.storageKey)
        await storage.remove(att.storageKey).catch((err: unknown) => {
          ctx.log.warn({ err, storageKey: att.storageKey }, 'attachment file delete failed')
        })
      return toJob(await jobs.load(userId, jobId))
    },

    async download(userId: string, jobId: string, aid: string) {
      const att = await db.jobAttachment.findFirst({ where: { id: aid, jobId, userId } })
      if (!att || att.kind !== 'file' || !att.storageKey) throw notFound('Attachment')
      const bytes = await storage.get(att.storageKey)
      if (!bytes) throw notFound('Attachment file')
      const type = ATTACHMENT_TYPES[extOf(att.storageKey)] ?? 'application/octet-stream'
      return { bytes, fileName: att.fileName ?? att.label, type }
    },
  }
}
