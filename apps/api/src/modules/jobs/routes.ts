import { Router, type Request, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import {
  RESUME_MAX_BYTES,
  attachmentLinkInput,
  importUrlInput,
  jobInput,
  parseJobDescription,
  parseJobInput,
  statusChangeInput,
  type JobInput,
  type StatusChangeInput,
} from '@copilot/shared'
import type { AppContext } from '../../context'
import { AppError, badRequest } from '../../lib/errors'
import { send } from '../../lib/http'
import { safeFetch } from '../../lib/safe-fetch'
import { attachmentDisposition, singleFileUpload } from '../../lib/upload'
import { requireAiAccess, requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { createAiService } from '../../ai/service'
import { jobParseTask } from '../../ai/tasks/job-parse'
import { attachmentService } from './attachments'
import { importJob } from './import'
import { jobService } from './service'

const IMPORT_FAILED =
  "We couldn't read this page automatically — LinkedIn, Indeed and many sites block it. We saved the link; paste the description when you have it."

const fileFields = z.object({
  label: z
    .string()
    .optional()
    .transform((s) => s?.trim().slice(0, 120) || undefined),
})

const singleFile = singleFileUpload({
  maxBytes: RESUME_MAX_BYTES,
  tooLarge: 'That file is larger than 4 MB',
  wrongShape: 'Upload one file in the "file" field',
})

/** Multipart → file upload; anything else → JSON link attachment. */
const attachmentBody: RequestHandler = (req, res, next) =>
  req.is('multipart/form-data')
    ? singleFile(req, res, next)
    : validate(attachmentLinkInput)(req, res, next)

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id
const jid = (req: Request) => String(req.params.id)

export function jobRoutes(ctx: AppContext) {
  const svc = jobService(ctx)
  const ai = createAiService(ctx)
  const files = attachmentService(ctx)
  const fetcher = ctx.httpFetch ?? safeFetch
  const r = Router()
  r.use(requireAuth)

  // Import makes outbound requests on the user's behalf: keep it from becoming a crawler/proxy.
  const importLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: ctx.config.NODE_ENV === 'test' ? 1000 : 30,
    keyGenerator: (req) => uid(req),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many imports. Try again later.' } },
  })

  // Attachment uploads fill storage: cap per user (the 20-per-job limit alone is per job).
  const uploadLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: ctx.config.NODE_ENV === 'test' ? 1000 : 60,
    keyGenerator: (req) => uid(req),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads. Try again later.' } },
  })

  r.get('/', async (req, res) => send(res, await svc.list(uid(req), req.query.archived === '1')))

  r.post('/parse', validate(parseJobInput), (req, res) =>
    send(res, parseJobDescription((req.body as { description: string }).description)),
  )
  r.post('/parse-ai', requireAiAccess, validate(parseJobInput), async (req, res) => {
    const text = (req.body as { description: string }).description
    send(res, await ai.run(uid(req), jobParseTask, text))
  })
  r.post('/import-url', importLimit, validate(importUrlInput), async (req, res) => {
    const result = await importJob((req.body as { url: string }).url, fetcher, ctx.log)
    if (!result) throw new AppError(422, 'IMPORT_FAILED', IMPORT_FAILED)
    send(res, result)
  })

  r.post('/', requireWritable, validate(jobInput), async (req, res) =>
    send(res, await svc.create(uid(req), req.body as JobInput), 201),
  )
  r.get('/:id', async (req, res) => send(res, await svc.get(uid(req), jid(req))))
  r.put('/:id', requireWritable, validate(jobInput.partial()), async (req, res) =>
    send(res, await svc.update(uid(req), jid(req), req.body as Partial<JobInput>)),
  )
  r.delete('/:id', requireWritable, async (req, res) => {
    await svc.remove(uid(req), jid(req))
    send(res, null)
  })
  r.post('/:id/status', requireWritable, validate(statusChangeInput), async (req, res) => {
    const { status, note } = req.body as StatusChangeInput
    send(res, await svc.setStatus(uid(req), jid(req), status, note))
  })
  r.post('/:id/archive', requireWritable, async (req, res) =>
    send(res, await svc.toggleArchive(uid(req), jid(req))),
  )

  r.post('/:id/attachments', requireWritable, uploadLimit, attachmentBody, async (req, res) => {
    if (!req.is('multipart/form-data')) {
      const link = req.body as { label: string; url: string }
      return send(res, await files.addLink(uid(req), jid(req), link), 201)
    }
    if (!req.file) throw badRequest('Choose a file to upload')
    const fields = fileFields.safeParse(req.body ?? {})
    if (!fields.success) throw badRequest('Invalid upload fields', fields.error.issues)
    const job = await files.addFile(uid(req), jid(req), {
      bytes: new Uint8Array(req.file.buffer),
      fileName: req.file.originalname,
      label: fields.data.label,
    })
    send(res, job, 201)
  })
  r.delete('/:id/attachments/:aid', requireWritable, async (req, res) =>
    send(res, await files.remove(uid(req), jid(req), String(req.params.aid))),
  )
  r.get('/:id/attachments/:aid/download', async (req, res) => {
    const { bytes, fileName, type } = await files.download(
      uid(req),
      jid(req),
      String(req.params.aid),
    )
    res
      .status(200)
      .set({
        'Content-Type': type,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': attachmentDisposition(fileName),
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      })
      .end(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  })

  return r
}
