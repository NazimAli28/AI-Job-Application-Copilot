import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ApplicationStatus, Attachment, Job, JobInput } from '@copilot/shared'
import { ApiRequestError, api } from '@/lib/api'
import { jobKeys } from '../api'

/** Refresh everything derived from a job's tracking data. */
export function syncJob(qc: QueryClient, job: Job) {
  qc.setQueryData(jobKeys.detail(job.id), job)
  for (const k of ['jobs', 'dashboard', 'analytics'] as const) {
    void qc.invalidateQueries({ queryKey: k === 'jobs' ? jobKeys.list : [k] })
  }
}

/** PUT /jobs/:id with a partial payload (posting and/or tracking fields). */
export function usePatchJob(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<JobInput>) => api.put<Job>(`/jobs/${id}`, patch),
    onSuccess: (job) => {
      syncJob(qc, job)
      void qc.invalidateQueries({ queryKey: jobKeys.match(id) })
    },
  })
}

export function useSetStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { status: ApplicationStatus; note?: string }) =>
      api.post<Job>(`/jobs/${id}/status`, v),
    onSuccess: (job) => syncJob(qc, job),
  })
}

export function useAddFileAttachment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { file: File; label?: string }) => {
      const fd = new FormData()
      fd.append('file', v.file)
      if (v.label) fd.append('label', v.label)
      return api.post<Job>(`/jobs/${id}/attachments`, fd)
    },
    onSuccess: (job) => syncJob(qc, job),
  })
}

export function useAddLinkAttachment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { label: string; url: string }) => api.post<Job>(`/jobs/${id}/attachments`, v),
    onSuccess: (job) => syncJob(qc, job),
  })
}

export function useDeleteAttachment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (aid: string) => api.delete<Job>(`/jobs/${id}/attachments/${aid}`),
    onSuccess: (job) => job && syncJob(qc, job),
  })
}

export async function downloadAttachment(jobId: string, a: Attachment) {
  const res = await fetch(`/api/jobs/${jobId}/attachments/${a.id}/download`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new ApiRequestError(res.status, 'NOT_FOUND', json?.error?.message ?? 'Download failed')
  }
  const url = URL.createObjectURL(await res.blob())
  const el = document.createElement('a')
  el.href = url
  el.download = a.fileName ?? a.label
  el.click()
  URL.revokeObjectURL(url)
}

/** Description save + parse flow used by the "Add the job description" card. */
export function useAnalyzeDescription(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (description: string) => {
      await api.put<Job>(`/jobs/${id}`, { description })
      const parsed = await api.post<{
        responsibilities: string[]
        requirements: Job['requirements']
      }>('/jobs/parse', { description })
      return api.put<Job>(`/jobs/${id}`, {
        responsibilities: parsed.responsibilities,
        requirements: parsed.requirements,
      })
    },
    onSuccess: (job) => {
      syncJob(qc, job)
      void qc.invalidateQueries({ queryKey: jobKeys.match(id) })
    },
  })
}
