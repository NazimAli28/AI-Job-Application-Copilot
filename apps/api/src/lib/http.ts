import type { Response } from 'express'

/** Success envelope `{ data }` (SRD §21). Errors go through the error middleware. */
export const send = <T>(res: Response, data: T, status = 200) => res.status(status).json({ data })
