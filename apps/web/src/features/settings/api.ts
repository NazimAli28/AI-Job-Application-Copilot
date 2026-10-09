import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AccessRequest, AiUsageInfo } from '@copilot/shared'
import { api } from '@/lib/api'

const key = ['admin', 'access-requests'] as const

export const useAccessRequests = (enabled = true) =>
  useQuery({ queryKey: key, queryFn: () => api.get<AccessRequest[]>('/admin/access-requests'), enabled })

export function useDecideRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'deny' }) =>
      api.post<AccessRequest>(`/admin/access-requests/${id}/${decision}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Today's AI Pro quota (+ monthly budget for admins). */
export const useAiUsage = (enabled = true) =>
  useQuery({ queryKey: ['ai', 'usage'], queryFn: () => api.get<AiUsageInfo>('/ai/usage'), enabled })

/** Collects the user's data from existing endpoints; endpoints that fail are skipped. */
export async function collectExport() {
  const paths = ['/profile', '/jobs', '/applications'] as const
  const results = await Promise.allSettled(paths.map((p) => api.get<unknown>(p)))
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() }
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[paths[i].slice(1)] = r.value
  })
  return out
}
