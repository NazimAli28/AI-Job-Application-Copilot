import type { ApplicationStatus } from './application'

export type DashboardStats = {
  totalApplications: number
  savedJobs: number
  active: number
  interviews: number
  offers: number
  rejections: number
  interviewRate: number // 0–100, of submitted applications
  offerRate: number
}

export type AnalyticsData = {
  stats: DashboardStats
  rejectionRate: number
  perWeek: { week: string; count: number }[] // week = ISO date of Monday
  perMonth: { month: string; count: number }[] // YYYY-MM
  byStatus: { status: ApplicationStatus; count: number }[]
  byEmploymentType: { label: string; count: number }[]
  byCompany: { label: string; count: number }[]
  byLocation: { label: string; count: number }[]
  avgDaysToInterview: number | null
  avgDaysBetweenStages: { from: ApplicationStatus; to: ApplicationStatus; days: number }[]
  matchVsOutcome: { bucket: string; applications: number; interviews: number; rate: number }[]
  /** Facts derived from data only — never speculation (SRD §16). */
  insights: { kind: 'fact' | 'suggestion'; text: string }[]
}

type JobRef = { id: string; title: string; company: string; status: ApplicationStatus }

/** GET /dashboard (D9: built from tracked jobs). */
export type DashboardData = {
  stats: DashboardStats
  recent: (JobRef & { matchScore?: number; appliedAt?: string; updatedAt: string })[]
  upcomingInterviews: (JobRef & { jobId: string; at: string })[]
  applySoon: (JobRef & { applyBy: string; overdue: boolean })[]
  needsDescription: (JobRef & { createdAt: string })[]
  nextActions: (JobRef & { nextAction: string; nextActionAt: string; overdue: boolean })[]
  counts: { jobs: number; resumes: number; profile: boolean }
  onboardingComplete: boolean
}

/** POST /analytics/ai-insights (✨). `message` explains an empty result. */
export type AiInsightsResult = { insights: AnalyticsData['insights']; message?: string }
