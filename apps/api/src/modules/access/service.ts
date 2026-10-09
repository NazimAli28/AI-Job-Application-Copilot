import type { AccessRequest, User } from '@copilot/shared'
import type { AppContext } from '../../context'
import type { Prisma } from '../../generated/prisma/client'
import { conflict, demoReadOnly, notFound } from '../../lib/errors'

const withUser = { user: { select: { email: true, name: true } } } as const
type Row = Prisma.AccessRequestGetPayload<{ include: typeof withUser }>

const toApi = (r: Row): AccessRequest => ({
  id: r.id,
  userId: r.userId,
  email: r.user.email,
  name: r.user.name,
  reason: r.reason,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
})

export type Decision = 'approve' | 'deny'

/** Invite-only AI Pro (D2): users request, ADMIN_EMAILS admins approve → `User.aiAccess`. */
export function accessService({ db }: AppContext) {
  return {
    async mine(userId: string) {
      const r = await db.accessRequest.findUnique({ where: { userId }, include: withUser })
      return r ? toApi(r) : null
    },

    /** One request per user; asking again replaces the reason and re-opens it as pending. */
    async request(user: User, reason: string) {
      if (user.isDemo) throw demoReadOnly('Create a free account to request AI access')
      if (user.aiAccess) throw conflict('You already have AI Pro access')
      const fields = { reason, status: 'pending' as const, decidedById: null, decidedAt: null }
      const r = await db.accessRequest.upsert({
        where: { userId: user.id },
        create: { userId: user.id, reason },
        update: { ...fields, createdAt: new Date() },
        include: withUser,
      })
      return toApi(r)
    },

    async list() {
      const rows = await db.accessRequest.findMany({
        include: withUser,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      return rows.map(toApi)
    },

    async decide(adminId: string, id: string, decision: Decision) {
      const approved = decision === 'approve'
      return db.$transaction(async (tx) => {
        const existing = await tx.accessRequest.findUnique({ where: { id } })
        if (!existing) throw notFound('Request')
        const r = await tx.accessRequest.update({
          where: { id },
          data: {
            status: approved ? 'approved' : 'denied',
            decidedById: adminId,
            decidedAt: new Date(),
          },
          include: withUser,
        })
        // Denying also revokes access previously granted through this request.
        await tx.user.update({ where: { id: r.userId }, data: { aiAccess: approved } })
        return toApi(r)
      })
    },
  }
}
