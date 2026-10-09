import { Router, type Request } from 'express'
import { z } from 'zod'
import { RESUME_MAX_BYTES } from '@copilot/shared'
import type { AppContext } from '../../context'
import { badRequest } from '../../lib/errors'
import { send } from '../../lib/http'
import { attachmentDisposition, singleFileUpload } from '../../lib/upload'
import { demoStoredAi, requireAiAccess, requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { hasPdfMagic } from './extract'
import { resumeService } from './service'

const labelInput = z.object({ label: z.string().max(80, 'Label must be 80 characters or fewer') })

const uploadFields = z.object({
  label: z
    .string()
    .optional()
    .transform((s) => s?.trim().slice(0, 80) || undefined),
  jobId: z
    .string()
    .max(64)
    .optional()
    .transform((s) => s?.trim() || null),
})

const singleFile = singleFileUpload({
  maxBytes: RESUME_MAX_BYTES,
  tooLarge: 'That file is larger than 4 MB. Export a smaller PDF.',
  wrongShape: 'Upload one PDF file in the "file" field',
})

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id
const rid = (req: Request) => String(req.params.id)

export function resumeRoutes(ctx: AppContext) {
  const svc = resumeService(ctx)
  const r = Router()
  r.use(requireAuth)

  r.get('/', async (req, res) => send(res, await svc.list(uid(req))))
  r.get('/:id', async (req, res) => send(res, await svc.get(uid(req), rid(req))))

  r.post('/', requireWritable, singleFile, async (req, res) => {
    const file = req.file
    if (!file) throw badRequest('Choose a PDF file to upload')
    const bytes = new Uint8Array(file.buffer)
    if (!hasPdfMagic(bytes)) throw badRequest('Only PDF resumes are supported right now')
    const fields = uploadFields.safeParse(req.body ?? {})
    if (!fields.success) throw badRequest('Invalid upload fields', fields.error.issues)
    const created = await svc.upload(uid(req), {
      bytes,
      fileName: file.originalname,
      ...fields.data,
    })
    send(res, created, 201)
  })

  r.patch('/:id', requireWritable, validate(labelInput), async (req, res) =>
    send(res, await svc.setLabel(uid(req), rid(req), (req.body as { label: string }).label)),
  )
  r.post('/:id/activate', requireWritable, async (req, res) => {
    await svc.activate(uid(req), rid(req))
    send(res, null)
  })
  r.delete('/:id', requireWritable, async (req, res) => {
    await svc.remove(uid(req), rid(req))
    send(res, null)
  })

  r.get('/:id/download', async (req, res) => {
    const { bytes, fileName } = await svc.download(uid(req), rid(req))
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': attachmentDisposition(fileName),
        'Cache-Control': 'private, no-store',
      })
      .end(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  })

  const storedAnalysis = demoStoredAi(async (req) => (await svc.get(uid(req), rid(req))).aiAnalysis)
  r.post('/:id/ai-analysis', storedAnalysis, requireAiAccess, async (req, res) =>
    send(res, await svc.aiAnalysis(uid(req), rid(req))),
  )

  return r
}
