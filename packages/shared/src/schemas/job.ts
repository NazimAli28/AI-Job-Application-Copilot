import { z } from 'zod'
import { httpUrl, id, isoDate, source } from './common'
import { workType } from './profile'
import { trackingInput, trackingSchema } from './tracking'

export const EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
] as const

export const jobRequirementSchema = z.object({
  id,
  kind: z.enum(['required', 'preferred']),
  category: z.enum(['skill', 'experience', 'education', 'other']),
  text: z.string(),
  /** Canonical skill name when category = skill. */
  skill: z.string().optional(),
})
export type JobRequirement = z.infer<typeof jobRequirementSchema>

/** Job posting details (what the employer wrote). */
export const jobPostingInput = z.object({
  title: z.string().trim().min(1, 'Job title is required').max(120),
  company: z.string().trim().min(1, 'Company is required').max(120),
  location: z.string().max(120).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  workType: workType.optional(),
  url: z.union([httpUrl(), z.literal('')]).optional(),
  salary: z.string().max(80).optional(),
  /** May be empty for link-only quick saves; match/tailor need it ("Needs description"). */
  description: z.string().max(20000),
  experienceYearsMin: z.number().min(0).max(30).optional(),
  educationRequirement: z.string().max(200).optional(),
  responsibilities: z.array(z.string()),
  requirements: z.array(jobRequirementSchema),
})

export const JOB_IMPORT_SOURCES = ['greenhouse', 'lever', 'jsonld', 'html'] as const

/** Create/update payload: posting details + optional tracking fields (D9). */
export const jobInput = jobPostingInput
  .extend(trackingInput.shape)
  .extend({ importedFrom: z.enum(JOB_IMPORT_SOURCES).optional() })
export type JobInput = z.infer<typeof jobInput>

/** A job = posting + its application tracking. Status "saved" is the first pipeline stage. */
export const jobSchema = jobPostingInput.extend(trackingSchema.shape).extend({
  id,
  /** Set when details were imported from a URL. */
  importedFrom: z.enum(JOB_IMPORT_SOURCES).optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type Job = z.infer<typeof jobSchema>

/** Minimum description length for match/tailoring to be meaningful. */
export const MIN_DESCRIPTION_CHARS = 50
export const needsDescription = (job: Pick<Job, 'description'>) =>
  job.description.trim().length < MIN_DESCRIPTION_CHARS

/** Result of parsing a pasted job description (editable before save). */
export type ParsedJob = Partial<z.infer<typeof jobPostingInput>> &
  Pick<z.infer<typeof jobPostingInput>, 'responsibilities' | 'requirements'>

export const parseJobInput = z.object({
  description: z.string().trim().min(50, 'Paste the full job description (50+ characters)'),
})

// ---- Match engine ----
export const SKILL_MATCH_STATUSES = ['strong', 'partial', 'missing', 'unknown'] as const
export type SkillMatchStatus = (typeof SKILL_MATCH_STATUSES)[number]

export const skillMatchSchema = z.object({
  skill: z.string(),
  requirementKind: z.enum(['required', 'preferred']),
  status: z.enum(SKILL_MATCH_STATUSES),
  /** Where the evidence came from, e.g. "Experience: Frontend Dev @ Acme". Empty when missing. */
  evidence: z.array(z.string()),
  /** User override applied (confirm/reject/learning). */
  corrected: z.boolean().optional(),
})
export type SkillMatch = z.infer<typeof skillMatchSchema>

const alignment = z.object({
  status: z.enum(['meets', 'below', 'above', 'unknown']),
  detail: z.string(),
})

export const matchResultSchema = z.object({
  jobId: id,
  score: z.number().min(0).max(100),
  breakdown: z.object({
    requiredSkills: z.number(),
    preferredSkills: z.number(),
    experience: z.number(),
    education: z.number(),
  }),
  skills: z.array(skillMatchSchema),
  experienceAlignment: alignment,
  educationAlignment: alignment,
  conflicts: z.array(z.string()),
  explanation: z.string(),
  recommendations: z.array(z.string()),
  source,
  computedAt: isoDate,
})
export type MatchResult = z.infer<typeof matchResultSchema>

export const skillCorrectionInput = z.object({
  skill: z.string().min(1),
  action: z.enum(['confirm', 'reject', 'learning']),
  evidence: z.string().max(500).optional(),
})
export type SkillCorrectionInput = z.infer<typeof skillCorrectionInput>

// ---- Tailoring ----
export const bulletSuggestionSchema = z.object({
  id,
  section: z.string(),
  original: z.string(),
  suggested: z.string(),
  reason: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
})
export type BulletSuggestion = z.infer<typeof bulletSuggestionSchema>

export const tailoringResultSchema = z.object({
  jobId: id,
  summary: z.string().optional(),
  skillOrder: z.array(z.string()),
  keywords: z.array(
    z.object({ keyword: z.string(), present: z.boolean(), suggestion: z.string() }),
  ),
  bulletSuggestions: z.array(bulletSuggestionSchema),
  sectionChanges: z.array(z.string()),
  source,
  createdAt: isoDate,
})
export type TailoringResult = z.infer<typeof tailoringResultSchema>

// ---- Cover letters ----
export const COVER_LETTER_LENGTHS = ['short', 'medium', 'long'] as const
export const COVER_LETTER_TONES = ['professional', 'friendly', 'confident'] as const

export const coverLetterInput = z.object({
  length: z.enum(COVER_LETTER_LENGTHS),
  tone: z.enum(COVER_LETTER_TONES),
  highlightIds: z.array(z.string()), // experience/project ids to emphasize
  companyInfo: z.string().max(2000).optional(),
  useAi: z.boolean().optional(),
})
export type CoverLetterInput = z.infer<typeof coverLetterInput>

export const coverLetterSchema = z.object({
  id,
  jobId: id,
  length: z.enum(COVER_LETTER_LENGTHS),
  tone: z.enum(COVER_LETTER_TONES),
  content: z.string(),
  source,
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type CoverLetter = z.infer<typeof coverLetterSchema>
