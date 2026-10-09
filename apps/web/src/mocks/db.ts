/**
 * Prototype-only persistence: a localStorage-backed "database" that mirrors the future Postgres
 * tables. Everything is scoped per user (like the real API's userId filter).
 * Replaced by the Express API in Phase 1+ — UI code never imports this file.
 */
import type {
  AccessRequest,
  Analysis,
  Certification,
  CoverLetter,
  Education,
  Experience,
  InterviewSession,
  Job,
  MatchResult,
  Profile,
  ProfileSkill,
  Project,
  Resume,
  TailoringResult,
  User,
} from '@copilot/shared'

export type StoredUser = User & { passwordHash: string }

export type UserData = {
  profile: Profile | null
  onboardingComplete: boolean
  skills: ProfileSkill[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  resumes: Resume[]
  jobs: Job[]
  matches: Record<string, MatchResult> // by jobId (rules)
  aiMatches: Record<string, MatchResult> // by jobId (AI Pro)
  tailoring: Record<string, TailoringResult> // by jobId
  aiTailoring: Record<string, TailoringResult>
  coverLetters: CoverLetter[]
  interviewSessions: InterviewSession[]
  analyses: Analysis[] // "Check my fit" results, newest first (D11)
  aiUsageToday: { date: string; count: number }
}

type Store = {
  version: number
  users: StoredUser[]
  sessionUserId: string | null // simulates the httpOnly session cookie
  resetTokens: { token: string; userId: string; expiresAt: number }[]
  accessRequests: AccessRequest[]
  data: Record<string, UserData>
}

const KEY = 'copilot.mockdb'
const VERSION = 3 // bump when UserData shape changes (old local data is discarded)

export const emptyUserData = (): UserData => ({
  profile: null,
  onboardingComplete: false,
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  resumes: [],
  jobs: [],
  matches: {},
  aiMatches: {},
  tailoring: {},
  aiTailoring: {},
  coverLetters: [],
  interviewSessions: [],
  analyses: [],
  aiUsageToday: { date: '', count: 0 },
})

const emptyStore = (): Store => ({
  version: VERSION,
  users: [],
  sessionUserId: null,
  resetTokens: [],
  accessRequests: [],
  data: {},
})

let cache: Store | null = null

function load(): Store {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Store) : null
    cache = parsed && parsed.version === VERSION ? parsed : emptyStore()
  } catch {
    cache = emptyStore()
  }
  return cache
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage full/blocked — prototype keeps working in memory */
  }
}

export const db = {
  read: load,
  /** Mutate the store and persist. */
  write<T>(fn: (s: Store) => T): T {
    const s = load()
    const result = fn(s)
    save()
    return result
  },
  userData(userId: string): UserData {
    const s = load()
    s.data[userId] ??= emptyUserData()
    return s.data[userId]
  },
  /** Mutate one user's data and persist. */
  update<T>(userId: string, fn: (d: UserData) => T): T {
    return db.write((s) => {
      s.data[userId] ??= emptyUserData()
      return fn(s.data[userId])
    })
  },
  reset() {
    cache = emptyStore()
    save()
  },
}

/** Not real hashing — prototype only. The API uses Argon2id. */
export const fakeHash = (pw: string) => `mock$${btoa(unescape(encodeURIComponent(pw)))}`
