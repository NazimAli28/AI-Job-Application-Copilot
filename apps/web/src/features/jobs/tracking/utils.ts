import { toast } from 'sonner'

export const savedToast = (what: string) => () => toast.success(`${what} saved`)

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
