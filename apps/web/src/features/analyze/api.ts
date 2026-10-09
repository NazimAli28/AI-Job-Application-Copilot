import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Analysis,
  AnalysisCoverLetterInput,
  AnalysisSummary,
  Job,
  MatchResult,
  RunAnalysisInput,
  SaveAnalysisInput,
  TailoringResult,
} from '@copilot/shared'
import { api } from '@/lib/api'

export const analysisKeys = {
  all: ['analyses'] as const,
  detail: (id: string) => ['analyses', id] as const,
}

export const useAnalyses = () =>
  useQuery({ queryKey: analysisKeys.all, queryFn: () => api.get<AnalysisSummary[]>('/analyses') })

export const useAnalysis = (id: string) =>
  useQuery({
    queryKey: analysisKeys.detail(id),
    queryFn: () => api.get<Analysis>(`/analyses/${id}`),
    retry: false,
  })

export function useRunAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: RunAnalysisInput) => api.post<Analysis>('/analyses', v),
    onSuccess: (a) => {
      qc.setQueryData(analysisKeys.detail(a.id), a)
      void qc.invalidateQueries({ queryKey: analysisKeys.all })
    },
    meta: { silent: true },
  })
}

export function useDeleteAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/analyses/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: analysisKeys.all }),
  })
}

export function useSaveAnalysis(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: SaveAnalysisInput) => api.post<Job>(`/analyses/${id}/save`, v),
    onSuccess: () => {
      for (const key of ['jobs', 'dashboard', 'analytics', 'analyses'])
        void qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

export const useAnalysisCoverLetter = (id: string) =>
  useMutation({
    mutationFn: (v: AnalysisCoverLetterInput) =>
      api.post<{ content: string }>(`/analyses/${id}/cover-letter`, v),
  })

export const useAnalysisAi = (id: string) =>
  useMutation({
    mutationFn: () =>
      api.post<{ match: MatchResult; tailoring: TailoringResult }>(`/analyses/${id}/ai`),
  })
