import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { badRequest } from '../lib/errors'

/** Validates `req.body` against a shared Zod schema and replaces it with the parsed value. */
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success)
      return next(badRequest('Please check the highlighted fields', result.error.issues))
    req.body = result.data
    next()
  }
