/**
 * Server-side demo account (Phase 9): the shared seed (`@copilot/shared/demo`, the same data the
 * offline prototype shows) written as rows, incl. pre-generated AI Pro results — the demo never
 * calls an LLM (its ✨ routes are read-only). Reseeded lazily on the first demo login of each UTC
 * day or when DEMO_SEED_VERSION changes ("nightly reset" that survives a sleeping free host).
 */
import {
  certificationSchema,
  educationSchema,
  experienceSchema,
  profileSchema,
  profileSkillSchema,
  projectSchema,
} from '@copilot/shared'
import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_SEED_VERSION,
  buildDemoData,
  type DemoData,
} from '@copilot/shared/demo'
import type { AppContext } from '../../context'
import type { Prisma } from '../../generated/prisma/client'
import { toColumns as ownedColumns } from '../../lib/owned'
import { makePdf } from '../../lib/pdf'
import { toColumns as jobColumns } from '../jobs/mapping'
import { skillKey } from '../profile/service'

/** Fixed id so the demo's storage keys stay stable across reseeds (files are overwritten). */
export const DEMO_USER_ID = 'usr_demo'

type Tx = Prisma.TransactionClient
const json = (v: unknown) => v as Prisma.InputJsonValue
const date = (iso: string) => new Date(iso)
const resumeKey = (resumeId: string) => `resumes/${DEMO_USER_ID}/${resumeId}.pdf`
/** Rows inserted together share `now()`; spaced timestamps keep list order = seed order. */
const nth = (base: string, i: number) => new Date(date(base).getTime() + i * 1000)

/** Fresh = seeded today (UTC) with the current seed version. */
export const isFresh = (u: { demoSeededAt: Date | null; demoSeedVersion: number | null }) =>
  u.demoSeedVersion === DEMO_SEED_VERSION &&
  !!u.demoSeededAt &&
  u.demoSeededAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)

async function writeRows(tx: Tx, d: DemoData, pdfSizes: Record<string, number>) {
  const userId = DEMO_USER_ID
  await tx.user.create({
    data: {
      id: userId,
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      isDemo: true,
      aiAccess: true,
      onboardingComplete: true,
      createdAt: date(d.createdAt),
      demoSeededAt: new Date(),
      demoSeedVersion: DEMO_SEED_VERSION,
    },
  })
  const profile = ownedColumns(profileSchema, d.profile) as Prisma.ProfileUncheckedCreateInput
  await tx.profile.create({ data: { ...profile, userId } })

  const owned = <T extends { id: string }>(
    items: T[],
    schema: Parameters<typeof ownedColumns>[0],
  ) =>
    items.map((v, i) => ({
      ...ownedColumns(schema, v),
      id: v.id,
      userId,
      createdAt: nth(d.createdAt, i),
    }))
  await tx.profileSkill.createMany({
    data: owned(d.skills, profileSkillSchema).map((s, i) => ({
      ...s,
      nameKey: skillKey(d.skills[i]!.name),
    })) as Prisma.ProfileSkillCreateManyInput[],
  })
  await tx.experience.createMany({
    data: owned(d.experience, experienceSchema) as Prisma.ExperienceCreateManyInput[],
  })
  await tx.education.createMany({
    data: owned(d.education, educationSchema) as Prisma.EducationCreateManyInput[],
  })
  await tx.project.createMany({
    data: owned(d.projects, projectSchema) as Prisma.ProjectCreateManyInput[],
  })
  await tx.certification.createMany({
    data: owned(d.certifications, certificationSchema) as Prisma.CertificationCreateManyInput[],
  })

  await tx.resume.createMany({
    data: d.resumes.map((r) => ({
      id: r.id,
      userId,
      fileName: r.fileName,
      label: r.label ?? null,
      fileSize: pdfSizes[r.id] ?? r.fileSize,
      storageKey: resumeKey(r.id),
      isActive: r.isActive,
      status: r.status,
      text: r.text ?? '',
      parsed: json(r.parsed),
      analysis: json(r.analysis),
      ...(r.aiAnalysis ? { aiAnalysis: json(r.aiAnalysis) } : {}),
      createdAt: date(r.uploadedAt),
    })),
  })

  // Jobs first without their sent cover letter (FK), linked once the letters exist.
  await tx.job.createMany({
    data: d.jobs.map((j) => ({
      ...(jobColumns(j) as Prisma.JobCreateManyInput),
      coverLetterId: null,
      id: j.id,
      userId,
      createdAt: date(j.createdAt),
      updatedAt: date(j.updatedAt),
    })),
  })
  await tx.jobStatusHistory.createMany({
    data: d.jobs.flatMap((j) =>
      j.history.map((h) => ({
        jobId: j.id,
        status: h.status,
        note: h.note ?? null,
        at: date(h.at),
      })),
    ),
  })
  await tx.jobAttachment.createMany({
    data: d.jobs.flatMap((j) =>
      j.materials.attachments.map((a) => ({
        id: a.id,
        userId,
        jobId: j.id,
        kind: a.kind,
        label: a.label,
        url: a.url ?? null,
        createdAt: date(a.addedAt),
      })),
    ),
  })

  const matches = [...Object.values(d.matches), ...Object.values(d.aiMatches)]
  await tx.jobMatch.createMany({
    data: matches.map((m) => ({
      jobId: m.jobId,
      source: m.source,
      score: m.score,
      result: json(m),
      computedAt: date(m.computedAt),
    })),
  })
  const tailorings = [...Object.values(d.tailoring), ...Object.values(d.aiTailoring)]
  await tx.jobTailoring.createMany({
    data: tailorings.map((t) => ({
      jobId: t.jobId,
      source: t.source,
      result: json(t),
      createdAt: date(t.createdAt),
    })),
  })
  await tx.coverLetter.createMany({
    data: d.coverLetters.map((c) => ({
      ...c,
      userId,
      createdAt: date(c.createdAt),
      updatedAt: date(c.updatedAt),
    })),
  })
  for (const j of d.jobs.filter((x) => x.materials.coverLetterId))
    await tx.job.update({
      where: { id: j.id },
      data: { coverLetterId: j.materials.coverLetterId },
    })

  await tx.analysis.createMany({
    data: d.analyses.map(({ id, createdAt, savedJobId, ...result }) => ({
      id,
      userId,
      resumeId: result.resumeId,
      savedJobId: savedJobId ?? null,
      result: json(result),
      createdAt: date(createdAt),
    })),
  })
  await tx.interviewSession.createMany({
    data: d.interviewSessions.map((s) => ({
      id: s.id,
      userId,
      jobId: s.jobId,
      jobTitle: s.jobTitle,
      company: s.company,
      mode: s.mode,
      questions: json(s.questions),
      answers: json(s.answers),
      status: s.status,
      createdAt: date(s.createdAt),
      completedAt: s.completedAt ? date(s.completedAt) : null,
    })),
  })
}

/**
 * Returns the demo user, (re)seeding it first when missing or stale. Concurrent first visits
 * serialize on an advisory lock; a reseed drops the old demo user (its sessions included).
 */
export async function ensureDemoUser(ctx: AppContext) {
  const { db, storage, log } = ctx
  const current = await db.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (current && isFresh(current)) return current

  const data = buildDemoData()
  const pdfs = Object.fromEntries(
    data.resumes.map((r) => [r.id, makePdf((r.text ?? '').split('\n'))]),
  )
  const sizes = Object.fromEntries(Object.entries(pdfs).map(([id, b]) => [id, b.length]))

  const user = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('demo-seed'))`
      const again = await tx.user.findUnique({ where: { email: DEMO_EMAIL } })
      if (again && isFresh(again)) return again
      if (again) await tx.user.delete({ where: { id: again.id } })
      await writeRows(tx, data, sizes)
      return tx.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } })
    },
    { timeout: 30_000, maxWait: 30_000 },
  )
  // Files after commit: the rows are what matters; a missing file only breaks the download.
  await Promise.all(
    Object.entries(pdfs).map(([id, bytes]) =>
      storage.put(resumeKey(id), bytes, 'application/pdf').catch((err: unknown) => {
        log.warn({ err, resumeId: id }, 'demo resume file upload failed')
      }),
    ),
  )
  log.info({ version: DEMO_SEED_VERSION }, 'demo account seeded')
  return user
}
