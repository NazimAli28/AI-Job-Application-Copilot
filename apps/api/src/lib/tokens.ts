import { createHmac, randomBytes } from 'node:crypto'

/** 256-bit random token for cookies / reset links (sent to the user, never stored). */
export const newToken = () => randomBytes(32).toString('base64url')

/** Keyed hash stored in the DB — a DB leak alone can't be replayed as a session. */
export const hashToken = (token: string, secret: string) =>
  createHmac('sha256', secret).update(token).digest('hex')
