import type { RequestHandler } from 'express'
import { forbidden } from '../lib/errors'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defense in depth (on top of SameSite=Lax cookies): browsers always send Origin on
 * cross-origin writes, so reject writes whose Origin isn't the web app.
 */
export const originCheck =
  (allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    const origin = req.get('origin')
    if (SAFE.has(req.method) || !origin || allowed.includes(origin)) return next()
    next(forbidden('Cross-site request blocked'))
  }
