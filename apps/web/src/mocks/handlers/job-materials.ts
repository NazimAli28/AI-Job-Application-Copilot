import { http, type HttpHandler } from 'msw'
import {
  ERROR_CODES,
  RESUME_MAX_BYTES,
  attachmentLinkInput,
  type Attachment,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db } from '../db'
import { auth, fail, latency, notFound, now, ok, parseBody, writable } from '../utils'

// Attachments for a job's "What I sent" section. See docs/kg/api-routes.md (Jobs).
const fileKey = (id: string) => `copilot.files.${id}`

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(bin)}`
}

const dropFile = (id: string) => {
  try {
    localStorage.removeItem(fileKey(id))
  } catch {
    /* ignore */
  }
}

export const jobMaterialsHandlers: HttpHandler[] = [
  http.post('/api/jobs/:id/attachments', async ({ params, request }) => {
    await latency(250)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    if (!a.data.jobs.some((j) => j.id === params.id)) return notFound('Job')

    let att: Attachment
    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await request.formData().catch(() => null)
      const file = form?.get('file')
      if (!(file instanceof File))
        return fail(400, ERROR_CODES.VALIDATION, 'Choose a file to upload')
      if (file.size === 0) return fail(400, ERROR_CODES.VALIDATION, 'That file is empty')
      if (file.size > RESUME_MAX_BYTES)
        return fail(400, ERROR_CODES.VALIDATION, 'That file is larger than 4 MB')
      const id = uid('att')
      const label =
        String(form?.get('label') ?? '')
          .trim()
          .slice(0, 120) || file.name
      const mimeType = file.type || 'application/octet-stream'
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        localStorage.setItem(fileKey(id), toDataUrl(bytes, mimeType))
      } catch {
        return fail(
          413,
          ERROR_CODES.VALIDATION,
          'Browser storage is full. Remove a file or use a link instead.',
        )
      }
      att = {
        id,
        kind: 'file',
        label,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        addedAt: now(),
      }
    } else {
      const body = await parseBody(request, attachmentLinkInput)
      if (!body.ok) return body.response
      att = { id: uid('att'), kind: 'link', ...body.value, addedAt: now() }
    }

    const job = db.update(a.user.id, (d) => {
      const j = d.jobs.find((x) => x.id === params.id)!
      j.materials = { ...j.materials, attachments: [...(j.materials?.attachments ?? []), att] }
      j.updatedAt = now()
      return j
    })
    return ok(job, 201)
  }),

  http.delete('/api/jobs/:id/attachments/:aid', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    if (!job.materials?.attachments.some((x) => x.id === params.aid)) return notFound('Attachment')
    const updated = db.update(a.user.id, (d) => {
      const j = d.jobs.find((x) => x.id === params.id)!
      j.materials = {
        ...j.materials,
        attachments: j.materials.attachments.filter((x) => x.id !== params.aid),
      }
      j.updatedAt = now()
      return j
    })
    dropFile(String(params.aid))
    return ok(updated)
  }),

  http.get('/api/jobs/:id/attachments/:aid/download', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const job = a.data.jobs.find((j) => j.id === params.id)
    const att = job?.materials?.attachments.find((x) => x.id === params.aid)
    if (!job || !att || att.kind !== 'file') return notFound('Attachment')
    let url: string | null = null
    try {
      url = localStorage.getItem(fileKey(att.id))
    } catch {
      /* ignore */
    }
    if (!url)
      return fail(
        404,
        ERROR_CODES.NOT_FOUND,
        'The original file is not available in this prototype',
      )
    const bytes = Uint8Array.from(atob(url.split(',')[1] ?? ''), (c) => c.charCodeAt(0))
    const name = (att.fileName ?? att.label).replace(/"/g, '')
    return new Response(bytes, {
      headers: {
        'Content-Type': att.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  }),
]
