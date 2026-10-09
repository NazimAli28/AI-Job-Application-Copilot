import { z } from 'zod'

export const id = z.string().min(1)
export const isoDate = z.string() // ISO 8601 string; dates cross the wire as strings
/** http(s) only — `javascript:`/`data:` links must never reach an <a href>. */
export const httpUrl = (message = 'Enter a valid URL') => z.url({ protocol: /^https?$/, message })

export const source = z.enum(['rules', 'ai']) // which engine produced a result
export type Source = z.infer<typeof source>

/** Consistent API envelope (SRD §21). */
export type ApiSuccess<T> = { data: T }
export type ApiError = { error: { code: string; message: string; details?: unknown } }

export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  AI_ACCESS_REQUIRED: 'AI_ACCESS_REQUIRED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  DEMO_READ_ONLY: 'DEMO_READ_ONLY',
  INTERNAL: 'INTERNAL_ERROR',
} as const
