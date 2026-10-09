import { randomUUID } from 'node:crypto'
import {
  analyzeResume,
  parseResumeText,
  type ParsedResume,
  type Resume,
  type ResumeAnalysis,
} from '@copilot/shared'
import type { Prisma, Resume as ResumeRow } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { notFound } from '../../lib/errors'
import { createAiService } from '../../ai/service'
import { resumeAnalysisTask } from '../../ai/tasks/resume-analysis'
import { extractPdfText } from './extract'

export type UploadInput = {
  bytes: Uint8Array
  fileName: string
  label?: string
  jobId?: string | null
}

const json = (v: unknown) => v as Prisma.InputJsonValue

/** Row → shared `Resume`. `text` only on the single-resume read (it is large). */
function toApi(r: ResumeRow, withText = false): Resume {
  return {
    id: r.id,
    fileName: r.fileName,
    label: r.label ?? undefined,
    jobId: r.jobId,
    fileSize: r.fileSize,
    uploadedAt: r.createdAt.toISOString(),
    isActive: r.isActive,
    status: r.status as Resume['status'],
    text: withText ? r.text : undefined,
    parsed: (r.parsed as ParsedResume | null) ?? null,
    analysis: (r.analysis as ResumeAnalysis | null) ?? null,
    aiAnalysis: (r.aiAnalysis as ResumeAnalysis | null) ?? null,
  }
}

/** Keeps the original file name readable but harmless (headers, logs, downloads). */
const cleanFileName = (name: string) =>
  name.replace(/[^\w .()-]/g, '_').slice(0, 120) || 'resume.pdf'

export function resumeService(ctx: AppContext) {
  const { db, storage } = ctx
  const aiService = createAiService(ctx)

  async function owned(userId: string, id: string) {
    const r = await db.resume.findFirst({ where: { id, userId } })
    if (!r) throw notFound('Resume')
    return r
  }

  return {
    async list(userId: string) {
      const rows = await db.resume.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
      return rows.map((r) => toApi(r))
    },

    async get(userId: string, id: string) {
      return toApi(await owned(userId, id), true)
    },

    /**
     * Extract → parse → rule-based analysis → store file + row. First resume becomes active.
     * With `jobId` (uploaded from a job's Resume tab) it also becomes that job's resume (D9).
     */
    async upload(userId: string, input: UploadInput) {
      const jobId = input.jobId ?? null
      if (jobId && !(await db.job.count({ where: { id: jobId, userId } }))) throw notFound('Job')
      const text = await extractPdfText(input.bytes)
      const parsed = parseResumeText(text)
      const profile = await db.profile.findUnique({
        where: { userId },
        select: { targetTitles: true },
      })
      const analysis = analyzeResume(parsed, text, profile?.targetTitles ?? [])

      const id = randomUUID()
      const storageKey = `resumes/${userId}/${id}.pdf`
      await storage.put(storageKey, input.bytes, 'application/pdf')
      try {
        const row = await db.$transaction(async (tx) => {
          const hasActive = await tx.resume.count({ where: { userId, isActive: true } })
          const created = await tx.resume.create({
            data: {
              id,
              userId,
              fileName: cleanFileName(input.fileName),
              label: input.label,
              jobId,
              fileSize: input.bytes.byteLength,
              storageKey,
              isActive: hasActive === 0,
              status: 'ready',
              text,
              parsed: json(parsed),
              analysis: json(analysis),
            },
          })
          if (jobId) await tx.job.update({ where: { id: jobId }, data: { resumeId: id } })
          return created
        })
        return toApi(row)
      } catch (e) {
        await storage.remove(storageKey) // no orphaned files
        throw e
      }
    },

    async setLabel(userId: string, id: string, label: string) {
      await owned(userId, id)
      const row = await db.resume.update({
        where: { id },
        data: { label: label.trim() || null },
      })
      return toApi(row)
    },

    async activate(userId: string, id: string) {
      await owned(userId, id)
      await db.$transaction([
        db.resume.updateMany({ where: { userId, NOT: { id } }, data: { isActive: false } }),
        db.resume.update({ where: { id }, data: { isActive: true } }),
      ])
    },

    /** Deletes row + file; if it was active, the newest remaining resume becomes active. */
    async remove(userId: string, id: string) {
      const target = await owned(userId, id)
      await db.$transaction(async (tx) => {
        await tx.resume.delete({ where: { id } })
        if (!target.isActive) return
        const next = await tx.resume.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
        if (next) await tx.resume.update({ where: { id: next.id }, data: { isActive: true } })
      })
      await storage.remove(target.storageKey).catch((err: unknown) => {
        ctx.log.warn({ err, storageKey: target.storageKey }, 'resume file delete failed')
      })
    },

    async download(userId: string, id: string) {
      const r = await owned(userId, id)
      const bytes = await storage.get(r.storageKey)
      if (!bytes) throw notFound('Resume file')
      return { bytes, fileName: r.fileName }
    },

    /** ✨ AI Pro analysis (rewrites + deeper advice on top of the rules analysis). Stored on the resume. */
    async aiAnalysis(userId: string, id: string) {
      const r = await owned(userId, id)
      if (!r.analysis) throw notFound('Resume analysis')
      const ai = await aiService.run(userId, resumeAnalysisTask, {
        analysis: r.analysis as ResumeAnalysis,
        text: r.text,
      })
      await db.resume.update({ where: { id }, data: { aiAnalysis: json(ai) } })
      return ai
    },

    /** Parsed data of the user's active resume (profile import). */
    async activeParsed(userId: string) {
      const r = await db.resume.findFirst({
        where: { userId, isActive: true },
        select: { parsed: true },
      })
      return (r?.parsed as ParsedResume | null | undefined) ?? null
    },
  }
}
