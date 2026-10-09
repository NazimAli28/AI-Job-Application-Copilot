import type { User } from '@copilot/shared'

declare global {
  namespace Express {
    interface Request {
      /** Set by loadSession when a valid session cookie is present. */
      user?: User
      sessionId?: string
    }
  }
}

export {}
