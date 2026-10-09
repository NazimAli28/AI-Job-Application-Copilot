import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '@copilot/shared'
import { api } from '@/lib/api'

export type { DashboardData }

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') })
