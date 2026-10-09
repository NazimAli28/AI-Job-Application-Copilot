import {
  computeMatch,
  needsDescription,
  normalizeSkill,
  profileSkillSchema,
  type Job,
  type MatchResult,
  type SkillCorrectionInput,
} from '@copilot/shared'
import type { Prisma } from '../../generated/prisma/client'
import type { AppContext } from '../../context'
import { AppError, badRequest } from '../../lib/errors'
import { skillKey } from '../profile/service'
import { createAiService } from '../../ai/service'
import { matchTask } from '../../ai/tasks/match'
import type { Candidate } from './bundle'

const STATUS = { confirm: 'confirmed', reject: 'rejected', learning: 'learning' } as const
const correctionFields = profileSkillSchema.pick({ name: true, evidence: true })

export const needsDescriptionError = () =>
  new AppError(409, 'NEEDS_DESCRIPTION', 'Add the job description to see your estimated fit.')

/** Skills the user set by hand show as "corrected" (same rule as the prototype). */
function markManual(m: MatchResult, profile: Candidate['profile']): MatchResult {
  const manual = new Set(
    profile.skills
      .filter((s) => s.source === 'manual')
      .map((s) => (normalizeSkill(s.name) ?? s.name).toLowerCase()),
  )
  return {
    ...m,
    skills: m.skills.map((s) =>
      manual.has(s.skill.toLowerCase()) ? { ...s, corrected: s.corrected ?? true } : s,
    ),
  }
}

export function matchService(ctx: AppContext) {
  const { db } = ctx
  const aiService = createAiService(ctx)
  const store = (jobId: string, m: MatchResult) =>
    db.jobMatch.upsert({
      where: { jobId_source: { jobId, source: m.source } },
      create: { jobId, source: m.source, score: m.score, result: m as Prisma.InputJsonValue },
      update: { score: m.score, result: m as Prisma.InputJsonValue, computedAt: new Date() },
    })

  /** Rules match, recomputed on every read (cheap, always reflects profile/resume edits). */
  async function rules(job: Job, c: Candidate) {
    if (needsDescription(job)) throw needsDescriptionError()
    const m = markManual(computeMatch(c.bundle, job), c.profile)
    await store(job.id, m)
    return m
  }

  return {
    rules,

    /** ✨ Same score/skills as rules; AI explanation + prioritised plan. */
    async ai(userId: string, job: Job, c: Candidate) {
      const m = await aiService.run(userId, matchTask, { base: await rules(job, c), job })
      await store(job.id, m)
      return m
    },

    /**
     * Confirm/reject/learning → the profile skill (created as `manual` when new), the AI match is
     * dropped as stale, and the rules match is recomputed with the skill flagged as corrected.
     */
    async correct(
      userId: string,
      job: Job,
      input: SkillCorrectionInput,
      reload: () => Promise<Candidate>,
    ) {
      if (needsDescription(job)) throw needsDescriptionError()
      const fields = correctionFields.safeParse({
        name: input.skill,
        evidence: input.evidence?.trim() || undefined,
      })
      if (!fields.success) throw badRequest('Please check the skill', fields.error.issues)
      const { name, evidence } = fields.data
      const status = STATUS[input.action]
      const nameKey = skillKey(name)
      await db.$transaction([
        db.profileSkill.upsert({
          where: { userId_nameKey: { userId, nameKey } },
          create: { userId, name, nameKey, status, evidence, source: 'manual' },
          update: { status, ...(evidence ? { evidence } : {}) },
        }),
        db.jobMatch.deleteMany({ where: { jobId: job.id, source: 'ai' } }),
      ])
      const m = await rules(job, await reload())
      const key = name.toLowerCase()
      const corrected = {
        ...m,
        skills: m.skills.map((s) =>
          s.skill.toLowerCase() === key ? { ...s, corrected: true } : s,
        ),
      }
      await store(job.id, corrected)
      return corrected
    },
  }
}
