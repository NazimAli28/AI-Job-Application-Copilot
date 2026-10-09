import { http } from 'msw'
import { extractText, getDocumentProxy } from 'unpdf'
import {
  ERROR_CODES,
  RESUME_MAX_BYTES,
  analyzeResume,
  parseResumeText,
  type Resume,
  type ResumeAnalysis,
  type ResumeIssue,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db } from '../db'
import { aiLatency, aiAllowed, auth, fail, latency, notFound, now, ok, writable } from '../utils'

const fileKey = (id: string) => `copilot.files.${id}`

function storeFile(id: string, bytes: Uint8Array) {
  try {
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    localStorage.setItem(fileKey(id), `data:application/pdf;base64,${btoa(bin)}`)
  } catch {
    /* quota exceeded — keep metadata, download will report it */
  }
}

const dropFile = (id: string) => {
  try {
    localStorage.removeItem(fileKey(id))
  } catch {
    /* ignore */
  }
}

const hasPdfMagic = (b: Uint8Array) =>
  b.length > 4 && String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === '%PDF'

/** Rephrase-only AI-style rewrite: never adds facts, uses placeholders for missing data. */
function aiRewrite(original: string): string {
  const base = original
    .replace(
      /^(responsible for|worked on|helped with|helped|assisted with|duties included)\s+/i,
      '',
    )
    .trim()
  const cleaned = base.charAt(0).toUpperCase() + base.slice(1)
  const hasNumber = /\d/.test(cleaned)
  return `${cleaned.replace(/[.;]$/, '')}${hasNumber ? '' : ' — [add metric: scale, % improvement or time saved]'}`
}

function toAiAnalysis(rules: ResumeAnalysis): ResumeAnalysis {
  const issues: ResumeIssue[] = rules.issues.map((i) => ({
    ...i,
    id: `ai_${i.id}`,
    suggestion:
      i.original && (i.category === 'achievements' || i.category === 'clarity')
        ? aiRewrite(i.original)
        : i.suggestion,
  }))
  return {
    ...rules,
    issues,
    recommendations: [
      ...rules.recommendations,
      'Lead each bullet with a strong verb, then the outcome, then how you did it.',
      'Only add numbers you can back up in an interview — replace each [add metric] placeholder with a real figure.',
    ],
    source: 'ai',
    analyzedAt: now(),
  }
}

export const resumeHandlers = [
  http.get('/api/resumes', async () => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    // Raw text is large and not needed in the list view.
    return ok(
      [...a.data.resumes]
        .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt))
        .map((r) => ({ ...r, text: undefined })),
    )
  }),

  http.post('/api/resumes', async ({ request }) => {
    await latency(300)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File))
      return fail(400, ERROR_CODES.VALIDATION, 'Choose a PDF file to upload')
    if (file.size > RESUME_MAX_BYTES)
      return fail(
        400,
        ERROR_CODES.VALIDATION,
        'That file is larger than 4 MB. Export a smaller PDF.',
      )
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (file.type !== 'application/pdf' || !hasPdfMagic(bytes))
      return fail(400, ERROR_CODES.VALIDATION, 'Only PDF resumes are supported right now')

    const label =
      String(form?.get('label') ?? '')
        .trim()
        .slice(0, 80) || undefined
    const jobId = String(form?.get('jobId') ?? '') || null
    if (jobId && !a.data.jobs.some((j) => j.id === jobId)) return notFound('Job')

    const id = uid('res')
    const base = { id, fileName: file.name, label, jobId, fileSize: file.size, uploadedAt: now() }
    let resume: Resume
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      const { text } = await extractText(pdf, { mergePages: true })
      if (text.trim().length < 40) throw new Error('empty')
      const parsed = parseResumeText(text)
      const keywords = a.data.profile?.targetTitles ?? []
      const analysis = analyzeResume(parsed, text, keywords)
      resume = {
        ...base,
        isActive: false,
        status: 'ready',
        text,
        parsed,
        analysis,
        aiAnalysis: null,
      }
    } catch {
      return fail(
        422,
        ERROR_CODES.VALIDATION,
        "We couldn't read text from this PDF. It may be a scanned image — export a text-based PDF and try again.",
      )
    }
    storeFile(id, bytes)
    db.update(a.user.id, (d) => {
      resume.isActive = !d.resumes.some((r) => r.isActive)
      d.resumes.push(resume)
      const job = jobId ? d.jobs.find((j) => j.id === jobId) : undefined
      if (job) {
        job.materials = { ...job.materials, resumeId: id }
        job.updatedAt = now()
      }
    })
    return ok({ ...resume, text: undefined }, 201)
  }),

  http.post('/api/resumes/:id/activate', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    if (!a.data.resumes.some((r) => r.id === params.id)) return notFound('Resume')
    db.update(a.user.id, (d) => d.resumes.forEach((r) => void (r.isActive = r.id === params.id)))
    return ok(null)
  }),

  http.patch('/api/resumes/:id', async ({ params, request }) => {
    await latency(100)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    if (!a.data.resumes.some((r) => r.id === params.id)) return notFound('Resume')
    const body = (await request.json().catch(() => null)) as { label?: unknown } | null
    if (typeof body?.label !== 'string' || body.label.length > 80)
      return fail(400, ERROR_CODES.VALIDATION, 'Label must be 80 characters or fewer')
    const label = body.label.trim() || undefined
    const updated = db.update(a.user.id, (d) => {
      const t = d.resumes.find((x) => x.id === params.id)!
      t.label = label
      return { ...t, text: undefined }
    })
    return ok(updated)
  }),

  http.delete('/api/resumes/:id', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const blocked = writable(a.user)
    if (blocked) return blocked
    const target = a.data.resumes.find((r) => r.id === params.id)
    if (!target) return notFound('Resume')
    db.update(a.user.id, (d) => {
      d.resumes = d.resumes.filter((r) => r.id !== target.id)
      for (const j of d.jobs)
        if (j.materials?.resumeId === target.id)
          j.materials = { ...j.materials, resumeId: undefined }
      // Keep one active resume when possible.
      if (target.isActive && d.resumes[0]) d.resumes[0].isActive = true
    })
    dropFile(target.id)
    return ok(null)
  }),

  http.get('/api/resumes/:id/download', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const r = a.data.resumes.find((x) => x.id === params.id)
    if (!r) return notFound('Resume')
    let url: string | null = null
    try {
      url = localStorage.getItem(fileKey(r.id))
    } catch {
      /* ignore */
    }
    if (!url)
      return fail(
        404,
        ERROR_CODES.NOT_FOUND,
        'The original file is not available in this prototype',
      )
    const bin = atob(url.split(',')[1] ?? '')
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${r.fileName}"`,
      },
    })
  }),

  http.post('/api/resumes/:id/ai-analysis', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const denied = aiAllowed(a.user)
    if (denied) return denied
    const r = a.data.resumes.find((x) => x.id === params.id)
    if (!r?.analysis) return notFound('Resume')
    await aiLatency()
    const ai = toAiAnalysis(r.analysis)
    db.update(a.user.id, (d) => {
      const t = d.resumes.find((x) => x.id === r.id)
      if (t) t.aiAnalysis = ai
    })
    return ok(ai)
  }),
]
