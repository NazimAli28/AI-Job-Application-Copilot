import { z } from 'zod'
import { id } from './common'

const optionalUrl = z.union([z.url('Enter a valid URL'), z.literal('')]).optional()

export const WORK_TYPES = ['remote', 'hybrid', 'onsite'] as const
export const workType = z.enum(WORK_TYPES)
export type WorkType = z.infer<typeof workType>

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.union([z.email(), z.literal('')]),
  phone: z.string().max(30).optional(),
  location: z.string().max(80).optional(),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  summary: z.string().max(2000).optional(),
  targetTitles: z.array(z.string().min(1)).max(10),
  yearsExperience: z.number().min(0).max(60),
  workTypes: z.array(workType),
  preferredLocations: z.array(z.string().min(1)).max(10),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().length(3).default('USD'),
})
export type Profile = z.infer<typeof profileSchema>

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
/** confirmed = user vouches for it; learning = in progress; rejected = user said "not me" */
export const SKILL_STATUSES = ['confirmed', 'learning', 'rejected'] as const

export const profileSkillSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  level: z.enum(SKILL_LEVELS).optional(),
  years: z.number().min(0).max(50).optional(),
  status: z.enum(SKILL_STATUSES),
  evidence: z.string().max(500).optional(),
  source: z.enum(['manual', 'resume']),
})
export type ProfileSkill = z.infer<typeof profileSkillSchema>

export const experienceSchema = z.object({
  id,
  title: z.string().trim().min(1).max(100),
  company: z.string().trim().min(1).max(100),
  location: z.string().max(80).optional(),
  startDate: z.string().min(1), // YYYY-MM
  endDate: z.string().optional(), // YYYY-MM; absent when current
  current: z.boolean(),
  bullets: z.array(z.string().max(400)),
  technologies: z.array(z.string()),
})
export type Experience = z.infer<typeof experienceSchema>

export const educationSchema = z.object({
  id,
  institution: z.string().trim().min(1).max(120),
  degree: z.string().trim().min(1).max(100),
  field: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  grade: z.string().max(30).optional(),
})
export type Education = z.infer<typeof educationSchema>

export const projectSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  url: optionalUrl,
  technologies: z.array(z.string()),
  bullets: z.array(z.string().max(400)),
})
export type Project = z.infer<typeof projectSchema>

export const certificationSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  issuer: z.string().max(100).optional(),
  date: z.string().optional(),
  url: optionalUrl,
})
export type Certification = z.infer<typeof certificationSchema>

/** Everything the engines need to know about a candidate. */
export type CandidateBundle = {
  profile: Profile | null
  skills: ProfileSkill[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  resumeText?: string
}

/** Which parts of the active resume's parsed data to merge into the profile. */
export const profileImportInput = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(200),
  experience: z.boolean(),
  education: z.boolean(),
  projects: z.boolean(),
})
export type ProfileImportInput = z.infer<typeof profileImportInput>
export type ProfileImportResult = {
  skills: number
  experience: number
  education: number
  projects: number
}
