import { z } from 'zod'
import { applicationStatus } from './application'
import { httpUrl, id, isoDate } from './common'
import { interviewQuestionSchema } from './interview'
import {
  COVER_LETTER_LENGTHS,
  COVER_LETTER_TONES,
  jobPostingInput,
  matchResultSchema,
  tailoringResultSchema,
} from './job'
import { resumeAnalysisSchema } from './resume'

/**
 * "Check my fit" (D11): the core flow. Resume + job description → full result, BEFORE saving a job.
 * Stored as a recent check; "Save as job" converts it into a tracked Job.
 */
export const runAnalysisInput = z
  .object({
    resumeId: z.string().min(1, 'Choose or upload a resume'),
    description: z.string().max(20000).optional(), // pasted JD (website, email, PDF text)
    url: z.union([httpUrl(), z.literal('')]).optional(),
  })
  .refine((v) => (v.description?.trim().length ?? 0) >= 50 || !!v.url, {
    message: 'Paste the job description (50+ characters) or add a link',
    path: ['description'],
  })
export type RunAnalysisInput = z.infer<typeof runAnalysisInput>

export const analysisSchema = z.object({
  id,
  createdAt: isoDate,
  resumeId: z.string(),
  resumeLabel: z.string(), // label or file name at the time of the check
  /** Parsed posting (editable later when saved). */
  job: jobPostingInput,
  importedFrom: z.enum(['greenhouse', 'lever', 'jsonld', 'html']).optional(),
  match: matchResultSchema,
  /** Resume quality re-scored with this job's keywords. */
  resumeAnalysis: resumeAnalysisSchema,
  tailoring: tailoringResultSchema,
  questions: z.array(interviewQuestionSchema),
  /** Set once saved as a tracked job. */
  savedJobId: z.string().optional(),
})
export type Analysis = z.infer<typeof analysisSchema>

/** List item for "Recent checks". */
export type AnalysisSummary = Pick<Analysis, 'id' | 'createdAt' | 'resumeLabel' | 'savedJobId'> & {
  title: string
  company: string
  score: number
}

export const saveAnalysisInput = z.object({
  status: applicationStatus.default('saved'),
  /** Optional edits to the parsed posting before saving. */
  title: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().min(1).max(120).optional(),
})
export type SaveAnalysisInput = z.input<typeof saveAnalysisInput>

export const analysisCoverLetterInput = z.object({
  length: z.enum(COVER_LETTER_LENGTHS),
  tone: z.enum(COVER_LETTER_TONES),
})
export type AnalysisCoverLetterInput = z.infer<typeof analysisCoverLetterInput>
