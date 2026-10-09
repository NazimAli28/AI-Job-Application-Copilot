import { analysesHandlers } from './analyses'
import { analyticsHandlers } from './analytics'
import { assistantHandlers } from './assistant'
import { authHandlers } from './auth'
import { devHandlers } from './dev'
import { interviewsHandlers } from './interviews'
import { jobMaterialsHandlers } from './job-materials'
import { jobsHandlers } from './jobs'
import { profileHandlers } from './profile'
import { resumeHandlers } from './resume'

// One file per feature; routes documented in docs/kg/api-routes.md.
export const handlers = [
  ...authHandlers,
  ...devHandlers,
  ...analysesHandlers,
  ...profileHandlers,
  ...resumeHandlers,
  ...jobsHandlers,
  ...jobMaterialsHandlers,
  ...assistantHandlers,
  ...analyticsHandlers,
  ...interviewsHandlers,
]
