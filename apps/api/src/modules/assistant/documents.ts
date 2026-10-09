import {
  computeMatch,
  generateCoverLetter,
  tailorResume,
  type CoverLetter,
  type CoverLetterInput,
  type Job,
  type TailoringResult,
} from '@copilot/shared'
import type { CoverLetter as LetterRow, Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { notFound } from '../../lib/errors'
import { createAiService } from '../../ai/service'
import { coverLetterTask } from '../../ai/tasks/cover-letter'
import { tailoringTask } from '../../ai/tasks/tailoring'
import { aiLetterNote } from './ai-preview'
import type { Candidate } from './bundle'

export type Source = 'rules' | 'ai'
export type SuggestionPatch = { status: 'accepted' | 'rejected'; suggested?: string }

const toLetter = (r: LetterRow): CoverLetter => ({
  id: r.id,
  jobId: r.jobId,
  length: r.length as CoverLetter['length'],
  tone: r.tone as CoverLetter['tone'],
  content: r.content,
  source: r.source as Source,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})

/** Tailoring results + cover letters for a job the caller already loaded (ownership checked). */
export function documentService(ctx: AppContext) {
  const { db } = ctx
  const ai = createAiService(ctx)
  const saveTailoring = async (jobId: string, t: TailoringResult) => {
    const result = t as Prisma.InputJsonValue
    await db.jobTailoring.upsert({
      where: { jobId_source: { jobId, source: t.source } },
      create: { jobId, source: t.source, result },
      update: { result },
    })
    return t
  }

  return {
    async getTailoring(jobId: string, source: Source) {
      const row = await db.jobTailoring.findUnique({
        where: { jobId_source: { jobId, source } },
      })
      return (row?.result as TailoringResult | undefined) ?? null
    },

    tailor(job: Job, c: Candidate) {
      return saveTailoring(job.id, tailorResume(c.bundle, job, computeMatch(c.bundle, job)))
    },

    async tailorAi(userId: string, job: Job, c: Candidate) {
      const t = await ai.run(userId, tailoringTask, { bundle: c.bundle, profile: c.profile, job })
      return saveTailoring(job.id, t)
    },

    /** Accept/reject (optionally edit) one suggestion; row-locked so concurrent clicks don't clobber. */
    patchSuggestion(jobId: string, source: Source, sid: string, patch: SuggestionPatch) {
      return db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string; result: TailoringResult }[]>`
          SELECT id, result FROM "JobTailoring"
          WHERE "jobId" = ${jobId} AND source = ${source} FOR UPDATE`
        const result = rows[0]?.result
        const sug = result?.bulletSuggestions.find((s) => s.id === sid)
        if (!result || !sug) throw notFound('Suggestion')
        sug.status = patch.status
        if (patch.suggested) sug.suggested = patch.suggested
        await tx.jobTailoring.update({
          where: { id: rows[0]!.id },
          data: { result: result as Prisma.InputJsonValue },
        })
        return result
      })
    },

    async listLetters(userId: string, jobId: string) {
      const rows = await db.coverLetter.findMany({
        where: { userId, jobId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map(toLetter)
    },

    async createLetter(userId: string, job: Job, c: Candidate, input: CoverLetterInput) {
      const source: Source = input.useAi ? 'ai' : 'rules'
      const text =
        source === 'ai'
          ? await ai.run(userId, coverLetterTask, { bundle: c.bundle, job, input })
          : generateCoverLetter(c.bundle, job, input)
      const row = await db.coverLetter.create({
        data: {
          userId,
          jobId: job.id,
          length: input.length,
          tone: input.tone,
          source,
          content: source === 'ai' ? `${text}${aiLetterNote}` : text,
        },
      })
      return toLetter(row)
    },

    async updateLetter(userId: string, id: string, content: string) {
      const { count } = await db.coverLetter.updateMany({
        where: { id, userId },
        data: { content },
      })
      if (!count) throw notFound('Cover letter')
      return toLetter(await db.coverLetter.findUniqueOrThrow({ where: { id } }))
    },

    /** Jobs that sent this letter keep existing (`Job.coverLetterId` → SetNull). */
    async removeLetter(userId: string, id: string) {
      const { count } = await db.coverLetter.deleteMany({ where: { id, userId } })
      if (!count) throw notFound('Cover letter')
    },
  }
}
