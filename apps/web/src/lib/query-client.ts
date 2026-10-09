import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiRequestError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiRequestError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.options.meta?.silent) return
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    },
  }),
})

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}
