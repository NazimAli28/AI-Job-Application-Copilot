import { ERROR_CODES } from '@copilot/shared'

/** Thrown anywhere in a handler; the error middleware turns it into the `{ error }` envelope. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const unauthenticated = (message = 'Please log in') =>
  new AppError(401, ERROR_CODES.UNAUTHENTICATED, message)
export const forbidden = (message = 'Not allowed') =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message)
export const notFound = (what = 'Resource') =>
  new AppError(404, ERROR_CODES.NOT_FOUND, `${what} not found`)
export const conflict = (message: string) => new AppError(409, ERROR_CODES.CONFLICT, message)
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, ERROR_CODES.VALIDATION, message, details)
export const demoReadOnly = (
  message = 'The demo is read-only — create a free account to make changes',
) => new AppError(403, ERROR_CODES.DEMO_READ_ONLY, message)

/** Prisma unique-constraint violation (e.g. a lost race on an upsert-like insert). */
export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002'
