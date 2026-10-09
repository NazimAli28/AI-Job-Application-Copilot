import { Router, type Request } from 'express'
import { profileImportInput, profileSchema, type ProfileImportInput } from '@copilot/shared'
import type { AppContext } from '../../context'
import { badRequest } from '../../lib/errors'
import { send } from '../../lib/http'
import { requireWritable } from '../../middleware/access'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/sessions'
import { resumeService } from '../resumes/service'
import { importFromResume } from './import'
import { profileService, type CollectionName } from './service'

const COLLECTIONS: CollectionName[] = [
  'skills',
  'experience',
  'education',
  'projects',
  'certifications',
]

/** Only reached behind requireAuth. */
const uid = (req: Request) => req.user!.id

export function profileRoutes(ctx: AppContext) {
  const svc = profileService(ctx)
  const resumes = resumeService(ctx)
  const r = Router()
  r.use(requireAuth)

  r.get('/', async (req, res) => send(res, await svc.get(uid(req))))
  r.put('/', requireWritable, validate(profileSchema), async (req, res) =>
    send(res, await svc.put(uid(req), req.body)),
  )
  // Allowed for the demo user too: it only flips a UI flag on their own account.
  r.post('/onboarding-complete', async (req, res) =>
    send(res, await svc.completeOnboarding(uid(req))),
  )

  // Merges the active stored resume's parsed data (the user picks what to import first).
  r.post('/import-from-resume', requireWritable, validate(profileImportInput), async (req, res) => {
    const parsed = await resumes.activeParsed(uid(req))
    if (!parsed) throw badRequest('Upload a resume first')
    send(res, await importFromResume(ctx, uid(req), req.body as ProfileImportInput, parsed))
  })

  for (const name of COLLECTIONS) {
    const c = svc.collections[name]
    r.get(`/${name}`, async (req, res) => send(res, await c.list(uid(req))))
    r.post(`/${name}`, requireWritable, validate(c.createSchema), async (req, res) =>
      send(res, await c.create(uid(req), req.body), 201),
    )
    r.patch(`/${name}/:id`, requireWritable, validate(c.patchSchema), async (req, res) =>
      send(res, await c.update(uid(req), String(req.params.id), req.body)),
    )
    r.delete(`/${name}/:id`, requireWritable, async (req, res) => {
      await c.remove(uid(req), String(req.params.id))
      send(res, null)
    })
  }

  return r
}
