import type { ParsedResume, ProfileImportInput, ProfileImportResult } from '@copilot/shared'
import type { AppContext } from '../../context'
import { skillKey } from './service'

const norm = (s: string) => s.trim().toLowerCase()

/** Keeps items whose key is new (vs existing rows and earlier items in the same batch). */
function fresh<T>(items: T[], existing: string[], key: (item: T) => string) {
  const seen = new Set(existing)
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Merges parsed resume data into the profile, skipping anything already there (idempotent).
 * `parsed` = the user's active stored Resume (routes read it; never client-supplied).
 */
export async function importFromResume(
  { db }: AppContext,
  userId: string,
  sel: ProfileImportInput,
  parsed: ParsedResume,
): Promise<ProfileImportResult> {
  return db.$transaction(async (tx) => {
    const [skills, experience, education, projects] = await Promise.all([
      tx.profileSkill.findMany({ where: { userId }, select: { nameKey: true } }),
      tx.experience.findMany({ where: { userId }, select: { title: true, company: true } }),
      tx.education.findMany({ where: { userId }, select: { institution: true, degree: true } }),
      tx.project.findMany({ where: { userId }, select: { name: true } }),
    ])
    const expKey = (x: { title: string; company: string }) => `${norm(x.title)}|${norm(x.company)}`
    const eduKey = (x: { institution: string; degree: string }) =>
      `${norm(x.institution)}|${norm(x.degree)}`

    const newSkills = fresh(
      sel.skills,
      skills.map((s) => s.nameKey),
      skillKey,
    )
    const newExp = sel.experience ? fresh(parsed.experience, experience.map(expKey), expKey) : []
    const newEdu = sel.education ? fresh(parsed.education, education.map(eduKey), eduKey) : []
    const newProj = sel.projects
      ? fresh(
          parsed.projects,
          projects.map((p) => norm(p.name)),
          (p) => norm(p.name),
        )
      : []

    await tx.profileSkill.createMany({
      data: newSkills.map((name) => ({
        userId,
        name: name.trim(),
        nameKey: skillKey(name),
        status: 'confirmed',
        source: 'resume',
      })),
    })
    await tx.experience.createMany({
      data: newExp.map((e) => {
        const current = !e.endDate || e.endDate === 'present'
        return {
          userId,
          title: e.title,
          company: e.company,
          startDate: e.startDate ?? '',
          endDate: current ? null : e.endDate,
          current,
          bullets: e.bullets,
          technologies: [],
        }
      }),
    })
    await tx.education.createMany({
      data: newEdu.map((e) => ({
        userId,
        institution: e.institution,
        degree: e.degree,
        endDate: e.endDate ?? null,
      })),
    })
    await tx.project.createMany({
      data: newProj.map((p) => ({
        userId,
        name: p.name,
        description: p.description,
        technologies: [],
        bullets: [],
      })),
    })

    return {
      skills: newSkills.length,
      experience: newExp.length,
      education: newEdu.length,
      projects: newProj.length,
    }
  })
}
