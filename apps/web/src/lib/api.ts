import type { ApiError } from '@copilot/shared'

export class ApiRequestError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const json = (await res.json().catch(() => null)) as { data: T } | ApiError | null
  if (!res.ok || !json || 'error' in json) {
    const err = json && 'error' in json ? json.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
    throw new ApiRequestError(res.status, err.code, err.message, err.details)
  }
  return json.data
}

/** Thin REST client. All requests go to same-origin /api (MSW in prototype, Express later). */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}
