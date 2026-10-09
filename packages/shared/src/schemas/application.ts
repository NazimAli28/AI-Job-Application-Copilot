import { z } from 'zod'
import { id, isoDate } from './common'

export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interview',
  'technical_interview',
  'final_interview',
  'offer',
  'rejected',
  'withdrawn',
] as const
export const applicationStatus = z.enum(APPLICATION_STATUSES)
export type ApplicationStatus = z.infer<typeof applicationStatus>

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  technical_interview: 'Technical Interview',
  final_interview: 'Final Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

/** Kanban columns (SRD §15). Interview sub-stages share the Interview column; Rejected/Withdrawn are closed lanes. */
export const KANBAN_COLUMNS: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: 'saved', label: 'Saved', statuses: ['saved'] },
  { key: 'applied', label: 'Applied', statuses: ['applied'] },
  { key: 'screening', label: 'Screening', statuses: ['screening'] },
  { key: 'interview', label: 'Interview', statuses: ['interview', 'technical_interview'] },
  { key: 'final', label: 'Final', statuses: ['final_interview'] },
  { key: 'offer', label: 'Offer', statuses: ['offer'] },
  { key: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn'] },
]

export const statusHistoryEntry = z.object({
  status: applicationStatus,
  at: isoDate,
  note: z.string().optional(),
})
export type StatusHistoryEntry = z.infer<typeof statusHistoryEntry>

/**
 * Flat "application view" of a tracked job, used as input to the analytics engine.
 * Since D9 the Job is the stored entity; derive this with `jobToApplication(job, matchScore)`.
 */
export const applicationSchema = z.object({
  id,
  jobId: z.string().nullable(),
  company: z.string(),
  jobTitle: z.string(),
  status: applicationStatus,
  appliedAt: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  tags: z.array(z.string()),
  interviewDates: z.array(z.string()),
  matchScore: z.number().optional(),
  history: z.array(statusHistoryEntry),
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type Application = z.infer<typeof applicationSchema>

export const statusChangeInput = z.object({ status: applicationStatus, note: z.string().max(500).optional() })
export type StatusChangeInput = z.infer<typeof statusChangeInput>
