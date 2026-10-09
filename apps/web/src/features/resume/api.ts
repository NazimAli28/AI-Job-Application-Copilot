import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Resume, ResumeAnalysis } from '@copilot/shared'
import { api, ApiRequestError } from '@/lib/api'
import { invalidateProfile } from '@/features/profile/api'

export const resumeKeys = { all: ['resumes'] as const }

export function useResumes() {
  return useQuery({ queryKey: resumeKeys.all, queryFn: () => api.get<Resume[]>('/resumes') })
}

function useRefresh() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: resumeKeys.all })
    void qc.invalidateQueries({ queryKey: ['jobs'] })
    invalidateProfile(qc)
  }
}

export type ResumeUpload = { file: File; label?: string; jobId?: string }

/** Upload to the library, optionally for a specific job (also sets that job's resume). */
export function useUploadResume() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (v: File | ResumeUpload) => {
      const { file, label, jobId } = v instanceof File ? ({ file: v } as ResumeUpload) : v
      const fd = new FormData()
      fd.append('file', file)
      if (label?.trim()) fd.append('label', label.trim())
      if (jobId) fd.append('jobId', jobId)
      return api.post<Resume>('/resumes', fd)
    },
    onSuccess: refresh,
    meta: { silent: true },
  })
}

export function usePatchResume() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (v: { id: string; label: string }) =>
      api.patch<Resume>(`/resumes/${v.id}`, { label: v.label }),
    onSuccess: refresh,
  })
}

export function useActivateResume() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) => api.post(`/resumes/${id}/activate`),
    onSuccess: refresh,
  })
}

export function useDeleteResume() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/resumes/${id}`),
    onSuccess: refresh,
  })
}

export function useAiResumeAnalysis() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) => api.post<ResumeAnalysis>(`/resumes/${id}/ai-analysis`),
    onSuccess: refresh,
  })
}

/** Fetches the original PDF and triggers a browser download. */
export async function downloadResume(r: Resume) {
  const res = await fetch(`/api/resumes/${r.id}/download`, { credentials: 'include' })
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new ApiRequestError(res.status, 'NOT_FOUND', json?.error?.message ?? 'Download failed')
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = r.fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Client-side check shared by upload zones. Returns an error message or null. */
export function validateResumeFile(file: File, maxBytes: number): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return 'Only PDF files are supported. Export your resume as a PDF and try again.'
  if (file.size > maxBytes) return 'That file is larger than 4 MB. Export a smaller PDF.'
  if (file.size === 0) return 'That file is empty.'
  return null
}
