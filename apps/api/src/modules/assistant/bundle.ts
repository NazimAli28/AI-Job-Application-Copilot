import {
  withResumeEvidence,
  type CandidateBundle,
  type Job,
  type ParsedResume,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { profileService } from '../profile/service'

export type Candidate = {
  /** Profile + resume evidence: what every engine scores against (D11). */
  bundle: CandidateBundle
  /** Profile only (manual corrections, candidate-specific AI questions). */
  profile: CandidateBundle
}

/** Which resume counts as evidence: a job's chosen one, or an explicit id (null = none). */
type ResumeSource = Job | { resumeId: string | null }

/**
 * Server `bundleOf` (same rule as the prototype): the profile plus the job's chosen resume
 * (`materials.resumeId`), else the active resume, as evidence — so a saved job scores the same
 * as the "Check my fit" result it came from. Analyses pass their own `resumeId` instead.
 */
export function candidateLoader(ctx: AppContext) {
  const profiles = profileService(ctx)
  return async function candidateFor(userId: string, src?: ResumeSource): Promise<Candidate> {
    const chosen = src && 'materials' in src ? src.materials.resumeId : src?.resumeId
    const [view, resume] = await Promise.all([
      profiles.get(userId),
      chosen === null
        ? null
        : ctx.db.resume.findFirst({
            where: chosen ? { userId, id: chosen } : { userId, isActive: true },
            select: { text: true, parsed: true },
          }),
    ])
    const { onboardingComplete: _o, ...profile } = view
    const bundle = resume
      ? withResumeEvidence(profile, resume.parsed as ParsedResume | null, resume.text)
      : profile
    return { bundle, profile }
  }
}
