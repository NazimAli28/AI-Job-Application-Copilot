import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  Certification,
  Education,
  Experience,
  Profile,
  ProfileSkill,
  Project,
} from '@copilot/shared'
import { api } from '@/lib/api'

export type ProfileBundle = {
  profile: Profile | null
  onboardingComplete: boolean
  skills: ProfileSkill[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
}

export type ImportSelection = {
  skills: string[]
  experience: boolean
  education: boolean
  projects: boolean
}

export type ImportResult = { skills: number; experience: number; education: number; projects: number }

export const profileKeys = { all: ['profile'] as const }

/** Profile changes affect job matches, so refresh those too. */
export function invalidateProfile(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: profileKeys.all })
  void qc.invalidateQueries({ queryKey: ['jobs'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useProfile() {
  return useQuery({ queryKey: profileKeys.all, queryFn: () => api.get<ProfileBundle>('/profile') })
}

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Profile) => api.put<Profile>('/profile', input),
    onSuccess: () => invalidateProfile(qc),
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/profile/onboarding-complete'),
    onSuccess: () => invalidateProfile(qc),
  })
}

export type CollectionName = 'skills' | 'experience' | 'education' | 'projects' | 'certifications'

/** Create / update / delete hooks for one profile collection. */
export function useCollection<T extends { id: string }>(name: CollectionName) {
  const qc = useQueryClient()
  const done = { onSuccess: () => invalidateProfile(qc) }
  return {
    create: useMutation({
      mutationFn: (input: Omit<T, 'id'>) => api.post<T>(`/profile/${name}`, input),
      ...done,
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: Partial<T> & { id: string }) => api.patch<T>(`/profile/${name}/${id}`, patch),
      ...done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/profile/${name}/${id}`),
      ...done,
    }),
  }
}

export function useImportFromResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sel: ImportSelection) => api.post<ImportResult>('/profile/import-from-resume', sel),
    onSuccess: () => invalidateProfile(qc),
  })
}

/** 0–100 profile completeness with the next best missing items. */
export function completeness(b: ProfileBundle): { pct: number; missing: string[] } {
  const p = b.profile
  const checks: [string, boolean][] = [
    ['Name and contact details', !!p?.fullName && !!p.email],
    ['Location', !!p?.location],
    ['Summary', !!p?.summary],
    ['Target job titles', !!p?.targetTitles.length],
    ['Work type preferences', !!p?.workTypes.length],
    ['At least 5 skills', b.skills.filter((s) => s.status !== 'rejected').length >= 5],
    ['Work experience', b.experience.length > 0],
    ['Education', b.education.length > 0],
    ['A project', b.projects.length > 0],
    ['Links (LinkedIn, GitHub or portfolio)', !!(p?.linkedinUrl || p?.githubUrl || p?.portfolioUrl)],
  ]
  const done = checks.filter(([, ok]) => ok).length
  return {
    pct: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([l]) => l),
  }
}
