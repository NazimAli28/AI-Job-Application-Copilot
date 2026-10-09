import type { RequestHandler } from 'express'
import multer from 'multer'
import { badRequest } from './errors'

/**
 * One multipart file in the `file` field, kept in memory (validated before anything is stored).
 * Multer errors become the `{ error }` envelope.
 */
export function singleFileUpload(opts: { maxBytes: number; tooLarge: string; wrongShape: string }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: opts.maxBytes, files: 1, fields: 5, fieldSize: 1024, parts: 8 },
  })
  const handler: RequestHandler = (req, res, next) =>
    upload.single('file')(req, res, (err: unknown) => {
      if (!err) return next()
      if (err instanceof multer.MulterError)
        return next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? opts.tooLarge : opts.wrongShape))
      next(err)
    })
  return handler
}

/** RFC 6266 filename: ASCII fallback + UTF-8 form. */
export const attachmentDisposition = (name: string) =>
  `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`
