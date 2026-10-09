import {
  buildQuestionSet,
  evaluateAnswer,
  type CreateInterviewInput,
  type InterviewQuestion,
  type InterviewSession,
  type SubmitAnswerInput,
} from '@copilot/shared'
import type { InterviewSession as SessionRow, Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { badRequest, notFound } from '../../lib/errors'
import { candidateLoader } from '../assistant/bundle'
import { jobService } from '../jobs/service'
import { createAiService } from '../../ai/service'
import { answerEvalTask } from '../../ai/tasks/interview'

const toSession = (r: SessionRow): InterviewSession => ({
  id: r.id,
  jobId: r.jobId,
  jobTitle: r.jobTitle,
  company: r.company,
  mode: r.mode as InterviewSession['mode'],
  questions: r.questions as InterviewQuestion[],
  answers: r.answers as InterviewSession['answers'],
  status: r.status as InterviewSession['status'],
  createdAt: r.createdAt.toISOString(),
  ...(r.completedAt ? { completedAt: r.completedAt.toISOString() } : {}),
})

/** Mock mode: ~6 questions mixed across types (same as the prototype). */
function mixed(pool: InterviewQuestion[], n = 6): InterviewQuestion[] {
  const buckets = (['technical', 'behavioral', 'candidate'] as const).map((t) =>
    pool.filter((q) => q.type === t),
  )
  const out: InterviewQuestion[] = []
  for (let i = 0; out.length < n && buckets.some((b) => i < b.length); i++)
    for (const b of buckets) if (i < b.length && out.length < n) out.push(b[i]!)
  return out
}

/** Practice/mock interview sessions for the caller's own jobs (`/interviews`). */
export function interviewService(ctx: AppContext) {
  const { db } = ctx
  const jobs = jobService(ctx)
  const candidateFor = candidateLoader(ctx)
  const ai = createAiService(ctx)

  async function load(userId: string, id: string) {
    const row = await db.interviewSession.findFirst({ where: { id, userId } })
    if (!row) throw notFound('Interview session')
    return row
  }

  return {
    async list(userId: string) {
      const rows = await db.interviewSession.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map(toSession)
    },

    async get(userId: string, id: string) {
      return toSession(await load(userId, id))
    },

    /** Questions = the job's rules set (+ AI questions the client holds), picked or mixed. */
    async create(userId: string, input: CreateInterviewInput) {
      const job = await jobs.get(userId, input.jobId)
      const { bundle } = await candidateFor(userId, job)
      const all = [...buildQuestionSet(bundle, job), ...(input.extraQuestions ?? [])]
      const pool = [...new Map(all.map((q) => [q.id, q])).values()]
      const questions = input.questionIds?.length
        ? pool.filter((q) => input.questionIds!.includes(q.id))
        : input.mode === 'mock'
          ? mixed(pool)
          : pool
      if (!questions.length)
        throw badRequest('No interview questions are available for this job yet')
      const row = await db.interviewSession.create({
        data: {
          userId,
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          mode: input.mode,
          questions: questions as Prisma.InputJsonValue,
        },
      })
      return toSession(row)
    },

    async remove(userId: string, id: string) {
      const { count } = await db.interviewSession.deleteMany({ where: { id, userId } })
      if (!count) throw notFound('Interview session')
    },

    /**
     * Evaluates and stores (replaces) the answer; row-locked so parallel answers don't clobber.
     * The (slow) AI evaluation runs before the transaction so no row lock is held during the call.
     */
    async answer(userId: string, id: string, input: SubmitAnswerInput, useAi: boolean) {
      const question = toSession(await load(userId, id)).questions.find(
        (x) => x.id === input.questionId,
      )
      if (!question) throw badRequest('Question is not part of this session')
      const evaluation = useAi
        ? await ai.run(userId, answerEvalTask, { question, answer: input.answer })
        : evaluateAnswer(question, input.answer)
      return db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "InterviewSession" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`
        if (!locked.length) throw notFound('Interview session')
        const session = toSession(await tx.interviewSession.findUniqueOrThrow({ where: { id } }))
        const q = session.questions.find((x) => x.id === input.questionId)
        if (!q) throw badRequest('Question is not part of this session')
        const answers = [
          ...session.answers.filter((x) => x.questionId !== q.id),
          { questionId: q.id, answer: input.answer, evaluation },
        ]
        const updated = await tx.interviewSession.update({
          where: { id },
          data: { answers: answers as Prisma.InputJsonValue },
        })
        return toSession(updated)
      })
    },

    async complete(userId: string, id: string) {
      const { count } = await db.interviewSession.updateMany({
        where: { id, userId },
        data: { status: 'completed', completedAt: new Date() },
      })
      if (!count) throw notFound('Interview session')
      return toSession(await load(userId, id))
    },
  }
}
