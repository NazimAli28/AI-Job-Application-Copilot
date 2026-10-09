import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const createWorker = () => setupWorker(...handlers)
