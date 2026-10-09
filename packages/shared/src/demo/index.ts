/**
 * Public demo account (Alex Morgan): sample profile, 2 resumes, 16 tracked jobs, matches,
 * tailoring, cover letters, interviews, "Check my fit" results and pre-generated AI Pro results.
 * Pure data built with the shared engines — seeded by the API (`modules/demo`) and by the
 * offline web mocks. All dates are relative to "now", so a reseed always looks fresh.
 * Import via `@copilot/shared/demo` (kept out of the main entry to stay out of app bundles).
 */
import {
  analysisSchema,
  analyzeResume,
  computeMatch,
  coverLetterSchema,
  interviewSessionSchema,
  jobSchema,
  matchResultSchema,
  needsDescription,
  parseResumeText,
  profileSchema,
  resumeSchema,
  tailorResume,
  tailoringResultSchema,
  type Analysis,
  type CandidateBundle,
  type Certification,
  type CoverLetter,
  type Education,
  type Experience,
  type InterviewSession,
  type Job,
  type MatchResult,
  type Profile,
  type ProfileSkill,
  type Project,
  type Resume,
  type TailoringResult,
} from '../index'
import { buildAnalyses } from './demo-analyses'
import { buildAiAnalysis, buildAiMatches, buildAiTailoring, buildCoverLetters } from './demo-ai'
import { buildInterviewSessions } from './demo-interviews'
import { buildJobs } from './demo-jobs'
import {
  RESUME_TEXT,
  certifications,
  education,
  experience,
  profile,
  projects,
  skills,
} from './demo-profile'
import { ago } from './helpers'

export { ago, ahead } from './helpers'

export const DEMO_EMAIL = 'demo@demo.dev'
export const DEMO_NAME = 'Alex Morgan'
/** Bump when the seed's content changes so deployed demos reseed on the next visit. */
export const DEMO_SEED_VERSION = 1

export type DemoData = {
  createdAt: string
  profile: Profile
  skills: ProfileSkill[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  resumes: Resume[]
  jobs: Job[]
  /** Rules / AI Pro results keyed by job id. */
  matches: Record<string, MatchResult>
  aiMatches: Record<string, MatchResult>
  tailoring: Record<string, TailoringResult>
  aiTailoring: Record<string, TailoringResult>
  coverLetters: CoverLetter[]
  interviewSessions: InterviewSession[]
  analyses: Analysis[]
}

export function buildDemoData(): DemoData {
  const bundle: CandidateBundle = {
    profile,
    skills,
    experience,
    education,
    projects,
    certifications,
    resumeText: RESUME_TEXT,
  }

  const parsed = parseResumeText(RESUME_TEXT)
  const analysis = analyzeResume(parsed, RESUME_TEXT, profile.targetTitles)
  const resume: Resume = {
    id: 'res_demo_1',
    label: 'Frontend version',
    fileName: 'Alex_Morgan_Resume.pdf',
    fileSize: 86_412,
    uploadedAt: ago(30, 9),
    isActive: true,
    status: 'ready',
    text: RESUME_TEXT,
    parsed,
    analysis: { ...analysis, analyzedAt: ago(30, 9) },
    aiAnalysis: buildAiAnalysis(),
  }

  // Second library resume (same facts, different emphasis label) so jobs can reference either.
  const resume2: Resume = {
    ...resume,
    id: 'res_demo_2',
    label: 'Full-stack version',
    fileName: 'Alex_Morgan_Resume_Fullstack.pdf',
    fileSize: 88_040,
    uploadedAt: ago(21, 9),
    isActive: false,
    aiAnalysis: undefined,
    analysis: { ...analysis, analyzedAt: ago(21, 9) },
  }

  const jobs = buildJobs()
  const matches: Record<string, MatchResult> = {}
  // Link-only quick saves have no description yet, so no match is computed for them.
  for (const j of jobs.filter((x) => !needsDescription(x)))
    matches[j.id] = { ...computeMatch(bundle, j), computedAt: ago(5, 12) }

  const top = jobs.find((j) => j.id === 'job_demo_1')!
  const second = jobs.find((j) => j.id === 'job_demo_2')!
  const tailoring: Record<string, TailoringResult> = {
    [top.id]: { ...tailorResume(bundle, top, matches[top.id]!), createdAt: ago(9, 11) },
    [second.id]: { ...tailorResume(bundle, second, matches[second.id]!), createdAt: ago(7, 11) },
  }

  return {
    createdAt: ago(75, 9),
    profile,
    skills,
    experience,
    education,
    projects,
    certifications,
    resumes: [resume, resume2],
    jobs,
    matches,
    aiMatches: buildAiMatches(bundle, jobs),
    tailoring,
    aiTailoring: { [top.id]: buildAiTailoring(bundle, top) },
    coverLetters: buildCoverLetters(bundle, top),
    interviewSessions: buildInterviewSessions(bundle, top),
    analyses: buildAnalyses(bundle, resume, jobs),
  }
}

type Schema = { safeParse: (v: unknown) => { success: boolean; error?: { issues: unknown[] } } }

/** Problems in the seed (schema drift, dangling references); empty when consistent. */
export function validateDemoData(d: DemoData): string[] {
  const problems: string[] = []
  const check = (label: string, schema: Schema, v: unknown) => {
    const r = schema.safeParse(v)
    if (!r.success) problems.push(`${label} failed validation: ${JSON.stringify(r.error?.issues)}`)
  }
  check('profile', profileSchema, d.profile)
  d.resumes.forEach((r) => check(`resume ${r.id}`, resumeSchema, r))
  d.jobs.forEach((j) => check(`job ${j.id}`, jobSchema, j))
  Object.values(d.matches).forEach((m) => check(`match ${m.jobId}`, matchResultSchema, m))
  Object.values(d.aiMatches).forEach((m) => check(`aiMatch ${m.jobId}`, matchResultSchema, m))
  Object.values(d.tailoring).forEach((t) => check(`tailoring ${t.jobId}`, tailoringResultSchema, t))
  Object.values(d.aiTailoring).forEach((t) =>
    check(`aiTailoring ${t.jobId}`, tailoringResultSchema, t),
  )
  d.analyses.forEach((a) => check(`analysis ${a.id}`, analysisSchema, a))
  d.coverLetters.forEach((c) => check(`coverLetter ${c.id}`, coverLetterSchema, c))
  d.interviewSessions.forEach((s) => check(`interview ${s.id}`, interviewSessionSchema, s))
  const resumeIds = new Set(d.resumes.map((r) => r.id))
  const jobIds = new Set(d.jobs.map((j) => j.id))
  for (const a of d.analyses)
    if (a.savedJobId && !jobIds.has(a.savedJobId))
      problems.push(`analysis ${a.id}: unknown savedJobId`)
  for (const j of d.jobs) {
    const rid = j.materials.resumeId
    if (rid && !resumeIds.has(rid)) problems.push(`job ${j.id} references missing resume ${rid}`)
  }
  for (const c of d.coverLetters)
    if (!jobIds.has(c.jobId)) problems.push(`cover letter ${c.id}: unknown job`)
  for (const s of d.interviewSessions)
    if (!jobIds.has(s.jobId)) problems.push(`interview ${s.id}: unknown job`)
  return problems
}
