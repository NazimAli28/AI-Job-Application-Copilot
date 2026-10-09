import { z } from 'zod'
import { applicationStatus, statusHistoryEntry } from './application'
import { httpUrl, id, isoDate } from './common'

/**
 * Application tracking fields that live ON the Job (D9: a job and its application are one entity;
 * "saved" is simply the first pipeline stage).
 */

export const JOB_SOURCES = [
  'linkedin',
  'indeed',
  'company_site',
  'job_board',
  'email',
  'referral',
  'recruiter',
  'other',
] as const
export const SOURCE_LABELS: Record<(typeof JOB_SOURCES)[number], string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  company_site: 'Company website',
  job_board: 'Other job board',
  email: 'Email',
  referral: 'Referral',
  recruiter: 'Recruiter reached out',
  other: 'Other',
}

export const contactSchema = z.object({
  id,
  name: z.string().trim().min(1, 'Name is required').max(100),
  role: z.string().max(100).optional(), // e.g. Recruiter, Hiring manager
  email: z.union([z.email(), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),
  linkedinUrl: z.union([httpUrl(), z.literal('')]).optional(),
})
export type Contact = z.infer<typeof contactSchema>

/** Anything else sent with the application: a file (stored) or a link. */
export const attachmentSchema = z.object({
  id,
  kind: z.enum(['file', 'link']),
  label: z.string().trim().min(1).max(120),
  url: z.string().optional(), // link target (kind = link)
  fileName: z.string().optional(), // kind = file
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  addedAt: isoDate,
})
export type Attachment = z.infer<typeof attachmentSchema>

export const screeningAnswerSchema = z.object({
  id,
  question: z.string().trim().min(1).max(500),
  answer: z.string().max(5000),
})
export type ScreeningAnswer = z.infer<typeof screeningAnswerSchema>

/** What the candidate actually sent. */
export const materialsSchema = z.object({
  resumeId: z.string().optional(), // resume from the library (or uploaded for this job)
  coverLetterId: z.string().optional(), // generated letter that was sent
  coverLetterText: z.string().max(10000).optional(), // or the user's own pasted letter
  attachments: z.array(attachmentSchema),
})
export type Materials = z.infer<typeof materialsSchema>

/** Editable tracking fields (all optional in create/update payloads). */
export const trackingInput = z.object({
  status: applicationStatus.optional(),
  archived: z.boolean().optional(),
  appliedAt: z.string().optional(), // YYYY-MM-DD
  applyBy: z.string().optional(), // deadline for saved jobs, YYYY-MM-DD
  nextAction: z.string().max(200).optional(), // e.g. "Follow up with recruiter"
  nextActionAt: z.string().optional(), // YYYY-MM-DD
  source: z.enum(JOB_SOURCES).optional(),
  referral: z.string().max(100).optional(), // who referred you
  reference: z.string().max(80).optional(), // job ID / requisition number
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  contacts: z.array(contactSchema).max(20).optional(),
  interviewDates: z.array(z.string()).optional(), // ISO datetimes
  materials: materialsSchema.optional(),
  screeningAnswers: z.array(screeningAnswerSchema).max(30).optional(),
})
export type TrackingInput = z.infer<typeof trackingInput>

/** Stored tracking state — defaults filled in by the API. */
export const trackingSchema = trackingInput.required({
  status: true,
  archived: true,
  tags: true,
  contacts: true,
  interviewDates: true,
  materials: true,
  screeningAnswers: true,
}).extend({
  history: z.array(statusHistoryEntry),
})
export type Tracking = z.infer<typeof trackingSchema>

export const defaultTracking = (): Tracking => ({
  status: 'saved',
  archived: false,
  tags: [],
  contacts: [],
  interviewDates: [],
  materials: { attachments: [] },
  screeningAnswers: [],
  history: [],
})

export const attachmentLinkInput = z.object({
  label: z.string().trim().min(1, 'Add a label').max(120),
  url: httpUrl(),
})

export const importUrlInput = z.object({ url: httpUrl().max(2048) })
export type ImportUrlResult = {
  provider: 'greenhouse' | 'lever' | 'jsonld' | 'html'
  /** Parsed fields — always reviewed by the user before saving. */
  job: import('./job').ParsedJob
}
