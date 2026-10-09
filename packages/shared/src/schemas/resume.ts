import { z } from 'zod'
import { id, isoDate, source } from './common'

export const parsedResumeSchema = z.object({
  contact: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()),
  }),
  summary: z.string().optional(),
  skills: z.array(z.string()),
  technologies: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({ institution: z.string(), degree: z.string(), endDate: z.string().optional() }),
  ),
  projects: z.array(z.object({ name: z.string(), description: z.string() })),
  certifications: z.array(z.string()),
  achievements: z.array(z.string()),
  /** Section headings detected in the text, in order. */
  sections: z.array(z.string()),
})
export type ParsedResume = z.infer<typeof parsedResumeSchema>

export const ANALYSIS_CATEGORIES = [
  'ats',
  'skills',
  'clarity',
  'achievements',
  'formatting',
] as const
export const analysisCategory = z.enum(ANALYSIS_CATEGORIES)

export const resumeIssueSchema = z.object({
  id,
  severity: z.enum(['high', 'medium', 'low']),
  category: analysisCategory,
  message: z.string(),
  /** Text the issue refers to (e.g. a weak bullet). */
  original: z.string().optional(),
  /** Concrete fix. Never adds facts — only rephrasing or a prompt for the user to supply data. */
  suggestion: z.string().optional(),
  section: z.string().optional(),
})
export type ResumeIssue = z.infer<typeof resumeIssueSchema>

export const resumeAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categories: z.array(
    z.object({
      key: analysisCategory,
      label: z.string(),
      score: z.number().min(0).max(100),
      observations: z.array(z.string()),
    }),
  ),
  issues: z.array(resumeIssueSchema),
  recommendations: z.array(z.string()),
  source,
  analyzedAt: isoDate,
})
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>

export const resumeSchema = z.object({
  id,
  fileName: z.string(),
  /** User label, e.g. "Frontend v2" or "Tailored for Acme". */
  label: z.string().max(80).optional(),
  /** Set when uploaded from a job's Resume tab ("used for this job"). */
  jobId: z.string().nullable().optional(),
  fileSize: z.number(),
  uploadedAt: isoDate,
  isActive: z.boolean(),
  status: z.enum(['processing', 'ready', 'failed']),
  text: z.string().optional(),
  parsed: parsedResumeSchema.nullable(),
  analysis: resumeAnalysisSchema.nullable(),
  /** AI Pro analysis, present only when generated for an aiAccess user (or demo sample). */
  aiAnalysis: resumeAnalysisSchema.nullable().optional(),
})
export type Resume = z.infer<typeof resumeSchema>

/** 4 MB: Vercel functions reject request bodies over 4.5 MB (multipart overhead included). */
export const RESUME_MAX_BYTES = 4 * 1024 * 1024
