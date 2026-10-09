import { HttpResponse, delay } from 'msw'
import { ERROR_CODES, withResumeEvidence, type CandidateBundle, type Job, type User } from '@copilot/shared'
import type { z } from 'zod'
import { db, type StoredUser, type UserData } from './db'

export const ok = <T>(data: T, status = 200) => HttpResponse.json({ data }, { status })

export const fail = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ error: { code, message, details } }, { status })

export const notFound = (what = 'Resource') => fail(404, ERROR_CODES.NOT_FOUND, `${what} not found`)

export const publicUser = ({ passwordHash: _omit, ...u }: StoredUser): User => u

/** Simulated network latency so loading states are visible. */
export const latency = (ms = 250) => delay(ms)
/** Simulated AI latency (AI Pro endpoints). */
export const aiLatency = () => delay(1400 + Math.random() * 800)

export const AI_DAILY_LIMIT = 30

type AuthOk = { user: StoredUser; data: UserData }

/** The mock db's session user (null when logged out). */
export const sessionUser = () => {
  const s = db.read()
  return s.users.find((u) => u.id === s.sessionUserId) ?? null
}

/** Session check — mirrors the API's requireAuth middleware. */
export function auth(): AuthOk | Response {
  const s = db.read()
  const user = s.users.find((u) => u.id === s.sessionUserId)
  if (!user) return fail(401, ERROR_CODES.UNAUTHENTICATED, 'Please log in')
  return { user, data: db.userData(user.id) }
}

/** Blocks writes for the public demo account. */
export function writable(user: StoredUser): Response | null {
  return user.isDemo
    ? fail(403, ERROR_CODES.DEMO_READ_ONLY, 'The demo is read-only — create a free account to make changes')
    : null
}

/** Mirrors requireAiAccess: invite-only + daily quota. */
export function aiAllowed(user: StoredUser): Response | null {
  if (!user.aiAccess)
    return fail(403, ERROR_CODES.AI_ACCESS_REQUIRED, 'AI Pro is invite-only. Request access in Settings.')
  if (user.isDemo) return writable(user)
  const today = new Date().toISOString().slice(0, 10)
  const used = db.update(user.id, (d) => {
    if (d.aiUsageToday.date !== today) d.aiUsageToday = { date: today, count: 0 }
    return d.aiUsageToday.count
  })
  if (used >= AI_DAILY_LIMIT)
    return fail(429, ERROR_CODES.AI_QUOTA_EXCEEDED, `Daily AI limit reached (${AI_DAILY_LIMIT}). Resets tomorrow.`)
  db.update(user.id, (d) => void d.aiUsageToday.count++)
  return null
}

/** Validates a JSON body against a shared Zod schema — mirrors the API's validate middleware. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; value: z.infer<S> } | { ok: false; response: Response }> {
  const body = await request.json().catch(() => null)
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, value: result.data }
  return {
    ok: false,
    response: fail(400, ERROR_CODES.VALIDATION, 'Please check the highlighted fields', result.error.issues),
  }
}

export const now = () => new Date().toISOString()

/** Profile-only candidate data (no resume evidence). */
export function profileBundle(d: UserData): CandidateBundle {
  return {
    profile: d.profile,
    skills: d.skills,
    experience: d.experience,
    education: d.education,
    projects: d.projects,
    certifications: d.certifications,
  }
}

/**
 * Everything the shared engines need about the candidate: profile + resume as evidence (D11).
 * Uses the resume picked for `job` (materials.resumeId) when given, otherwise the active resume —
 * so a saved job scores the same as the "Check my fit" result it came from.
 */
export function bundleOf(d: UserData, job?: Job): CandidateBundle {
  const resume =
    (job?.materials.resumeId && d.resumes.find((r) => r.id === job.materials.resumeId)) ||
    d.resumes.find((r) => r.isActive)
  return resume
    ? withResumeEvidence(profileBundle(d), resume.parsed, resume.text)
    : profileBundle(d)
}
