import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApplicationStatus,
  ImportUrlResult,
  Job,
  JobInput,
  MatchResult,
  ParsedJob,
  SkillCorrectionInput,
} from '@copilot/shared'
import { api } from '@/lib/api'

export type JobListItem = Job & { matchScore?: number; needsDescription: boolean }

export const jobKeys = {
  all: ['jobs'] as const,
  /** Prefix matching every list query (active + archived). */
  list: ['jobs', 'list'] as const,
  listFor: (archived = false) => ['jobs', 'list', archived ? 'archived' : 'active'] as const,
  detail: (id: string) => ['jobs', id] as const,
  match: (id: string) => ['jobs', id, 'match'] as const,
}

export function useJobs(includeArchived = false) {
  return useQuery({
    queryKey: jobKeys.listFor(includeArchived),
    queryFn: () => api.get<JobListItem[]>(`/jobs${includeArchived ? '?archived=1' : ''}`),
  })
}

export function useJob(id: string) {
  return useQuery({ queryKey: jobKeys.detail(id), queryFn: () => api.get<Job>(`/jobs/${id}`) })
}

/** Jobs, dashboard and analytics all derive from jobs. */
function useInvalidate() {
  const qc = useQueryClient()
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: jobKeys.list }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['analytics'] }),
      id ? qc.invalidateQueries({ queryKey: jobKeys.match(id) }) : undefined,
    ])
}

export function useCreateJob() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: JobInput) => api.post<Job>('/jobs', input),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: Partial<JobInput>) => api.put<Job>(`/jobs/${id}`, input),
    onSuccess: (job) => {
      qc.setQueryData(jobKeys.detail(id), job)
      return invalidate(id)
    },
  })
}

/** Update any job by id (list actions: archive, etc.). */
export function useUpdateJobById() {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<JobInput>) => api.put<Job>(`/jobs/${id}`, input),
    onSuccess: (job) => {
      qc.setQueryData(jobKeys.detail(job.id), job)
      return invalidate()
    },
  })
}

type StatusVars = { id: string; status: ApplicationStatus; note?: string }

/** Optimistic status change with rollback (board drag, move menu, selects). */
export function useChangeJobStatus(fixedId?: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: StatusVars) => api.post<Job>(`/jobs/${fixedId ?? id}/status`, body),
    onMutate: async ({ id, status }: StatusVars) => {
      await qc.cancelQueries({ queryKey: jobKeys.list })
      const prev = qc.getQueriesData<JobListItem[]>({ queryKey: jobKeys.list })
      qc.setQueriesData<JobListItem[]>({ queryKey: jobKeys.list }, (list) =>
        list?.map((j) => (j.id === (fixedId ?? id) ? { ...j, status } : j)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSuccess: (job) => qc.setQueryData(jobKeys.detail(job.id), job),
    onSettled: () => invalidate(),
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: jobKeys.detail(id) })
      return invalidate()
    },
  })
}

/** Toggles `archived` (alias endpoint; same as PUT { archived }). */
export function useArchiveJob() {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.post<Job>(`/jobs/${id}/archive`),
    onSuccess: (job) => {
      qc.setQueryData(jobKeys.detail(job.id), job)
      return invalidate()
    },
  })
}

/** Import posting details from a URL. IMPORT_FAILED (422) is handled inline by the caller. */
export function useImportUrl() {
  return useMutation({
    mutationFn: (url: string) => api.post<ImportUrlResult>('/jobs/import-url', { url }),
    meta: { silent: true },
  })
}

export function useParseJob(ai: boolean) {
  return useMutation({
    mutationFn: (description: string) =>
      api.post<ParsedJob>(ai ? '/jobs/parse-ai' : '/jobs/parse', { description }),
  })
}

export function useMatch(id: string) {
  return useQuery({ queryKey: jobKeys.match(id), queryFn: () => api.get<MatchResult>(`/jobs/${id}/match`) })
}

export function useAiMatch(id: string) {
  return useMutation({ mutationFn: () => api.post<MatchResult>(`/jobs/${id}/match/ai`) })
}

export function useSkillCorrection(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SkillCorrectionInput) => api.post<MatchResult>(`/jobs/${id}/match/corrections`, input),
    onSuccess: (match) => {
      qc.setQueryData(jobKeys.match(id), match)
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: jobKeys.list })
    },
  })
}
