import { useMutation, useQuery } from '@tanstack/react-query'
import type { AiInsightsResult, AnalyticsData } from '@copilot/shared'
import { api } from '@/lib/api'

export type { AiInsightsResult }

export const useAnalytics = () =>
  useQuery({ queryKey: ['analytics'], queryFn: () => api.get<AnalyticsData>('/analytics') })

export const useAiInsights = () =>
  useMutation({ mutationFn: () => api.post<AiInsightsResult>('/analytics/ai-insights') })
