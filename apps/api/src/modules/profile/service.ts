import {
  certificationSchema,
  educationSchema,
  experienceSchema,
  profileSchema,
  profileSkillSchema,
  projectSchema,
  type Profile,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { ownedCollection, toApi, toColumns, type OwnedDelegate } from '../../lib/owned'

export const skillKey = (name: string) => name.trim().toLowerCase()

export type CollectionName = 'skills' | 'experience' | 'education' | 'projects' | 'certifications'

export function profileService({ db }: AppContext) {
  // Prisma's generic delegate signatures are wider than the OwnedDelegate slice.
  const d = (delegate: unknown) => delegate as OwnedDelegate
  const collections = {
    skills: ownedCollection({
      delegate: d(db.profileSkill),
      schema: profileSkillSchema,
      label: 'Skill',
      derive: (s) => ({ nameKey: skillKey(s.name) }),
      conflictMessage: (s) => `"${s.name}" is already in your skills`,
    }),
    experience: ownedCollection({
      delegate: d(db.experience),
      schema: experienceSchema,
      label: 'Experience',
    }),
    education: ownedCollection({
      delegate: d(db.education),
      schema: educationSchema,
      label: 'Education',
    }),
    projects: ownedCollection({ delegate: d(db.project), schema: projectSchema, label: 'Project' }),
    certifications: ownedCollection({
      delegate: d(db.certification),
      schema: certificationSchema,
      label: 'Certification',
    }),
  } satisfies Record<CollectionName, unknown>

  return {
    collections,

    /** GET /profile — the whole candidate profile in one round trip. */
    async get(userId: string) {
      const [user, profile, skills, experience, education, projects, certifications] =
        await Promise.all([
          db.user.findUniqueOrThrow({
            where: { id: userId },
            select: { onboardingComplete: true },
          }),
          db.profile.findUnique({ where: { userId } }),
          collections.skills.list(userId),
          collections.experience.list(userId),
          collections.education.list(userId),
          collections.projects.list(userId),
          collections.certifications.list(userId),
        ])
      return {
        profile: profile ? toApi(profileSchema, profile) : null,
        onboardingComplete: user.onboardingComplete,
        skills,
        experience,
        education,
        projects,
        certifications,
      }
    },

    async put(userId: string, input: Profile) {
      const data = toColumns(profileSchema, input) as Profile
      const row = await db.profile.upsert({
        where: { userId },
        create: { ...data, userId },
        update: data,
      })
      return toApi(profileSchema, row)
    },

    async completeOnboarding(userId: string) {
      await db.user.update({ where: { id: userId }, data: { onboardingComplete: true } })
      return { onboardingComplete: true }
    },
  }
}
