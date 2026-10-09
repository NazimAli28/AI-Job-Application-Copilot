import type { Analysis } from '../schemas/analysis'
import type { Job, ParsedJob } from '../schemas/job'
import type { CandidateBundle } from '../schemas/profile'
import type { Resume } from '../schemas/resume'
import { defaultTracking } from '../schemas/tracking'
import { withResumeEvidence } from './candidate'
import { buildQuestionSet } from './interview'
import { parseJobDescription } from './job-parser'
import { computeMatch } from './match'
import { analyzeResume } from './resume-analyzer'
import { parseResumeText } from './resume-parser'
import { tailorResume } from './tailoring'

export type BuildAnalysisArgs = {
  id: string
  createdAt: string
  resume: Pick<Resume, 'id' | 'fileName' | 'label' | 'text' | 'parsed'>
  /** Profile data only; the resume is merged in as evidence here. */
  bundle: CandidateBundle
  description: string
  url?: string
  /** Pre-parsed/imported posting; falls back to parseJobDescription(description). */
  imported?: ParsedJob
  importedFrom?: Analysis['importedFrom']
}

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/** Hostname without `www.` (no URL global: shared is lib-agnostic). */
const hostOf = (url?: string): string | undefined =>
  url
    ?.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^:/?#]+)/i)?.[1]
    ?.toLowerCase()
    .replace(/^www\./, '')

/** The temporary (unsaved) Job the engines score an analysis against. */
export const analysisJob = (id: string, createdAt: string, posting: Analysis['job']): Job => ({
  ...posting,
  ...defaultTracking(),
  id: `tmp_${id}`,
  createdAt,
  updatedAt: createdAt,
})

/**
 * "Check my fit" pipeline (D11), shared by the API, the MSW mock and the demo seed:
 * parse the posting, then match, resume re-analysis with the job's keywords, tailoring and
 * interview questions — all against profile + resume evidence. Pure.
 */
export function buildAnalysis(args: BuildAnalysisArgs): {
  analysis: Analysis
  job: Job
  candidate: CandidateBundle
} {
  const { id, createdAt, resume, description, url, imported, importedFrom } = args
  const parsed = imported
    ? { ...parseJobDescription(description), ...defined(imported) }
    : parseJobDescription(description)
  const posting: Analysis['job'] = defined({
    title: parsed.title?.trim() || 'Untitled role',
    company: parsed.company?.trim() || hostOf(url) || 'Unknown company',
    location: parsed.location,
    employmentType: parsed.employmentType,
    workType: parsed.workType,
    url: url || parsed.url || undefined,
    salary: parsed.salary,
    description: description || parsed.description || '',
    experienceYearsMin: parsed.experienceYearsMin,
    educationRequirement: parsed.educationRequirement,
    responsibilities: parsed.responsibilities,
    requirements: parsed.requirements,
  }) as Analysis['job']

  const job = analysisJob(id, createdAt, posting)
  const text = resume.text ?? ''
  const candidate = withResumeEvidence(args.bundle, resume.parsed, text)
  const match = computeMatch(candidate, job)
  const keywords = job.requirements
    .filter((r) => r.category === 'skill')
    .map((r) => r.skill ?? r.text)
  const resumeAnalysis = analyzeResume(resume.parsed ?? parseResumeText(text), text, keywords)
  const tailoring = tailorResume(candidate, job, match)
  const questions = buildQuestionSet(candidate, job)

  const analysis: Analysis = {
    id,
    createdAt,
    resumeId: resume.id,
    resumeLabel: resume.label || resume.fileName,
    job: posting,
    ...(importedFrom ? { importedFrom } : {}),
    match: { ...match, computedAt: createdAt },
    resumeAnalysis: { ...resumeAnalysis, analyzedAt: createdAt },
    tailoring: { ...tailoring, createdAt },
    questions,
  }
  return { analysis, job, candidate }
}
