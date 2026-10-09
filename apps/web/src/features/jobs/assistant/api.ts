import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CoverLetter,
  CoverLetterInput,
  Experience,
  Project,
  Source,
  TailoringResult,
} from '@copilot/shared'
import { api } from '@/lib/api'

const tKey = (jobId: string, source: Source = 'rules') =>
  ['jobs', jobId, 'tailoring', source] as const
const cKey = (jobId: string) => ['jobs', jobId, 'cover-letters'] as const

export function useTailoring(jobId: string) {
  return useQuery({
    queryKey: tKey(jobId),
    queryFn: () => api.get<TailoringResult | null>(`/jobs/${jobId}/tailoring`),
  })
}

export function useAiTailoring(jobId: string) {
  return useQuery({
    queryKey: tKey(jobId, 'ai'),
    queryFn: () => api.get<TailoringResult | null>(`/jobs/${jobId}/tailoring?source=ai`),
  })
}

export function useGenerateTailoring(jobId: string, source: Source) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<TailoringResult>(source === 'ai' ? `/jobs/${jobId}/tailoring/ai` : `/jobs/${jobId}/tailoring`),
    onSuccess: (r) => qc.setQueryData(tKey(jobId, source), r),
  })
}

export function useReviewSuggestion(jobId: string, source: Source) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { sid: string; status: 'accepted' | 'rejected'; suggested?: string }) =>
      api.patch<TailoringResult>(
        `/jobs/${jobId}/tailoring/suggestions/${v.sid}${source === 'ai' ? '?source=ai' : ''}`,
        { status: v.status, suggested: v.suggested },
      ),
    onSuccess: (r) => qc.setQueryData(tKey(jobId, source), r),
  })
}

export function useCoverLetters(jobId: string) {
  return useQuery({
    queryKey: cKey(jobId),
    queryFn: () => api.get<CoverLetter[]>(`/jobs/${jobId}/cover-letters`),
  })
}

export function useGenerateCoverLetter(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CoverLetterInput) => api.post<CoverLetter>(`/jobs/${jobId}/cover-letters`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: cKey(jobId) }),
  })
}

export function useSaveCoverLetter(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; content: string }) =>
      api.put<CoverLetter>(`/cover-letters/${v.id}`, { content: v.content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cKey(jobId) }),
  })
}

export function useDeleteCoverLetter(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cover-letters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: cKey(jobId) }),
  })
}

/** Experience + projects to choose cover-letter highlights from. */
export function useHighlightables() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<{ experience: Experience[]; projects: Project[] }>('/profile'),
  })
}
