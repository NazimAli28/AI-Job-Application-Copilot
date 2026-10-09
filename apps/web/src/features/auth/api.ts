import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccessRequest,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  User,
} from '@copilot/shared'
import { api, ApiRequestError } from '@/lib/api'

export const authKeys = { me: ['auth', 'me'] as const, access: ['access-request'] as const }

/** Current user, or null when logged out. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await api.get<User>('/auth/me')
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
  })
}

/** For components rendered inside the authenticated app shell. */
export function useCurrentUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useCurrentUser used outside authenticated routes')
  return data
}

function useSetUser() {
  const qc = useQueryClient()
  return (user: User | null) => {
    // Set `me` first so auth guards redirect before the shell re-renders without a user.
    qc.setQueryData(authKeys.me, user)
    if (!user) qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
  }
}

export function useLogin() {
  const setUser = useSetUser()
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<User>('/auth/login', input),
    onSuccess: setUser,
    meta: { silent: true },
  })
}

export function useRegister() {
  const setUser = useSetUser()
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<User>('/auth/register', input),
    onSuccess: setUser,
    meta: { silent: true },
  })
}

export function useDemoLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<User>('/auth/demo'),
    onSuccess: (user) => {
      qc.clear()
      qc.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const setUser = useSetUser()
  return useMutation({
    mutationFn: () => api.post<null>('/auth/logout'),
    onSuccess: () => setUser(null),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      api.post<{ message: string; devResetLink?: string }>('/auth/forgot-password', input),
    meta: { silent: true },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      api.post<{ message: string }>('/auth/reset-password', input),
    meta: { silent: true },
  })
}

export function useMyAccessRequest() {
  return useQuery({
    queryKey: authKeys.access,
    queryFn: () => api.get<AccessRequest | null>('/access-requests/mine'),
  })
}

export function useRequestAiAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => api.post<AccessRequest>('/access-requests', { reason }),
    onSuccess: (r) => qc.setQueryData(authKeys.access, r),
  })
}

/** Prototype-only: switch tier from the dev toolbar. */
export function useDevTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { aiAccess?: boolean; role?: 'user' | 'admin' }) => api.post('/dev/tier', body),
    onSuccess: () => qc.invalidateQueries(),
  })
}
