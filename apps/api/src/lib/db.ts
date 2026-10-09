import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export type Db = PrismaClient

export function createDb(connectionString: string, opts: { max?: number } = {}): Db {
  const adapter = new PrismaPg({ connectionString, max: opts.max })
  return new PrismaClient({ adapter })
}
