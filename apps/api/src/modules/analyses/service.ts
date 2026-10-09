import { randomUUID } from 'node:crypto'
import {
  analysisJob,
  buildAnalysis,
  generateCoverLetter,
  needsDescription,
  type Analysis,
  type AnalysisCoverLetterInput,
  type AnalysisSummary,
  type ParsedJob,
  type ParsedResume,
  type RunAnalysisInput,
  type SaveAnalysisInput,
} from '@copilot/shared'
import type { Analysis as AnalysisRow, Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { AppError, notFound } from '../../lib/errors'
import { safeFetch } from '../../lib/safe-fetch'
import { createAiService } from '../../ai/service'
import { matchTask } from '../../ai/tasks/match'
import { tailoringTask } from '../../ai/tasks/tailoring'
import { candidateLoader } from '../assistant/bundle'
import { documentService } from '../assistant/documents'
import { matchService } from '../assistant/match'
import { importJob } from '../jobs/import'
import { jobService } from '../jobs/service'

/** Recent checks kept per user (older ones are deleted on each new check). */
export const MAX_ANALYSES = 20
const IMPORT_FAILED =
  "We couldn't read this page automatically — LinkedIn, Indeed and many sites block it. Paste the job description instead."

type Stored = Omit<Analysis, 'id' | 'createdAt' | 'savedJobId'>

const toAnalysis = (r: AnalysisRow): Analysis => ({
  ...(r.result as Stored),
  id: r.id,
  createdAt: r.createdAt.toISOString(),
  ...(r.savedJobId ? { savedJobId: r.savedJobId } : {}),
})

const summary = (a: Analysis): AnalysisSummary => ({
  id: a.id,
  createdAt: a.createdAt,
  resumeLabel: a.resumeLabel,
  savedJobId: a.savedJobId,
  title: a.job.title,
  company: a.job.company,
  score: a.match.score,
})

/** "Check my fit" (D11): resume + posting → full result before saving; "Save as job" → Job. */
export function analysisService(ctx: AppContext) {
  const { db } = ctx
  const jobs = jobService(ctx)
  const candidateFor = candidateLoader(ctx)
  const match = matchService(ctx)
  const docs = documentService(ctx)
  const aiService = createAiService(ctx)
  const fetcher = ctx.httpFetch ?? safeFetch

  async function load(userId: string, id: string) {
    const row = await db.analysis.findFirst({ where: { id, userId } })
    if (!row) throw notFound('Analysis')
    return row
  }

  /** Engine inputs for a stored check: its temporary job + the profile with its resume (if kept). */
  async function context(row: AnalysisRow) {
    const a = toAnalysis(row)
    const job = analysisJob(a.id, a.createdAt, a.job)
    return { a, job, c: await candidateFor(row.userId, { resumeId: row.resumeId }) }
  }

  return {
    async run(userId: string, input: RunAnalysisInput) {
      const resume = await db.resume.findFirst({
        where: { id: input.resumeId, userId },
        select: { id: true, fileName: true, label: true, text: true, parsed: true },
      })
      if (!resume) throw notFound('Resume')

      const url = input.url || undefined
      let description = input.description?.trim() ?? ''
      let imported: ParsedJob | undefined
      let importedFrom: Analysis['importedFrom']
      if (url && description.length < 50) {
        const res = await importJob(url, fetcher, ctx.log)
        const text = res?.job.description?.trim() ?? ''
        if (!res || text.length < 50) throw new AppError(422, 'IMPORT_FAILED', IMPORT_FAILED)
        imported = res.job
        importedFrom = res.provider
        description = text
      }

      const { profile } = await candidateFor(userId, { resumeId: null })
      const createdAt = new Date()
      const { analysis } = buildAnalysis({
        id: randomUUID(),
        createdAt: createdAt.toISOString(),
        resume: {
          ...resume,
          label: resume.label ?? undefined,
          parsed: resume.parsed as ParsedResume | null,
        },
        bundle: profile,
        description,
        url,
        imported,
        importedFrom,
      })
      const { id, createdAt: _c, savedJobId: _s, ...result } = analysis
      await db.$transaction(async (tx) => {
        await tx.analysis.create({
          data: {
            id,
            userId,
            resumeId: resume.id,
            createdAt,
            result: result as Prisma.InputJsonValue,
          },
        })
        const old = await tx.analysis.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: MAX_ANALYSES,
          select: { id: true },
        })
        if (old.length)
          await tx.analysis.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
      })
      return analysis
    },

    async list(userId: string) {
      const rows = await db.analysis.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_ANALYSES,
      })
      return rows.map((r) => summary(toAnalysis(r)))
    },

    async get(userId: string, id: string) {
      return toAnalysis(await load(userId, id))
    },

    async remove(userId: string, id: string) {
      const { count } = await db.analysis.deleteMany({ where: { id, userId } })
      if (!count) throw notFound('Analysis')
    },

    /**
     * Creates the tracked Job (chosen resume, history) and its server match + rules tailoring —
     * same engines and resume, so the job scores like the check. Idempotent: a check that is
     * already saved returns its job; concurrent saves race on `savedJobId` and the loser's job
     * is removed again.
     */
    async save(userId: string, id: string, input: SaveAnalysisInput) {
      const row = await load(userId, id)
      if (row.savedJobId) return { job: await jobs.get(userId, row.savedJobId), created: false }
      const a = toAnalysis(row)
      const { status = 'saved', title, company } = input
      const job = await jobs.create(userId, {
        ...a.job,
        ...(title ? { title } : {}),
        ...(company ? { company } : {}),
        ...(a.importedFrom ? { importedFrom: a.importedFrom } : {}),
        status,
        materials: { attachments: [], ...(row.resumeId ? { resumeId: row.resumeId } : {}) },
      })
      const { count } = await db.analysis.updateMany({
        where: { id, userId, savedJobId: null },
        data: { savedJobId: job.id },
      })
      if (!count) {
        await jobs.remove(userId, job.id)
        const winner = await load(userId, id)
        if (!winner.savedJobId) throw notFound('Analysis')
        return { job: await jobs.get(userId, winner.savedJobId), created: false }
      }
      if (!needsDescription(job)) {
        const c = await candidateFor(userId, job)
        await match.rules(job, c)
        await docs.tailor(job, c)
      }
      return { job, created: true }
    },

    /** Rules cover letter for an unsaved check (not stored; saved jobs keep their own letters). */
    async coverLetter(userId: string, id: string, input: AnalysisCoverLetterInput) {
      const { job, c } = await context(await load(userId, id))
      return { content: generateCoverLetter(c.bundle, job, { ...input, highlightIds: [] }) }
    },

    /** ✨ Deeper analysis (2 AI calls); not stored, like the prototype. */
    async ai(userId: string, id: string) {
      const { a, job, c } = await context(await load(userId, id))
      const [m, tailoring] = await Promise.all([
        aiService.run(userId, matchTask, { base: a.match, job }),
        aiService.run(userId, tailoringTask, { bundle: c.bundle, profile: c.profile, job }),
      ])
      return { match: m, tailoring }
    },
  }
}
