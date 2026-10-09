import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ERROR_CODES } from '@copilot/shared'
import { AppError, notFound } from '../lib/errors'

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Route'))

/** Single place that renders `{ error: { code, message, details? } }`. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  // body-parser errors (malformed JSON, payload too large)
  const status = typeof err?.status === 'number' ? err.status : 500
  if (status >= 400 && status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Malformed JSON body' : String(err.message)
    res.status(status).json({ error: { code: ERROR_CODES.VALIDATION, message } })
    return
  }
  req.log?.error({ err }, 'unhandled error')
  res.status(500).json({ error: { code: ERROR_CODES.INTERNAL, message: 'Something went wrong' } })
}
