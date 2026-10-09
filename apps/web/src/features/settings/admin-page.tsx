import { useState } from 'react'
import { Check, Inbox, ShieldAlert, X } from 'lucide-react'
import type { AccessRequest } from '@copilot/shared'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCurrentUser } from '@/features/auth/api'
import { formatDate } from '@/lib/format'
import { useAccessRequests, useDecideRequest } from './api'

type Filter = 'all' | AccessRequest['status']
const FILTERS: Filter[] = ['all', 'pending', 'approved', 'denied']

export function AdminPage() {
  const user = useCurrentUser()
  const isAdmin = user.role === 'admin'
  const q = useAccessRequests(isAdmin)
  const decide = useDecideRequest()
  const [filter, setFilter] = useState<Filter>('pending')

  if (!isAdmin)
    return (
      <EmptyState
        icon={ShieldAlert}
        title="403 · Admins only"
        description="You don't have permission to view this page."
      />
    )

  const rows = q.data ?? []
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter((r) => r.status === f).length)
  const shown = rows.filter((r) => filter === 'all' || r.status === filter)

  return (
    <div>
      <PageHeader title="AI access requests" description="Approve or deny invite-only AI Pro access." />
      {q.isPending ? (
        <PageSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            className="flex-wrap justify-start"
            aria-label="Filter by status"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f} className="capitalize">
                {f} ({count(f)})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {shown.length === 0 ? (
            <EmptyState icon={Inbox} title="No requests" description="Nothing matches this filter." />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="min-w-56">Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell className="whitespace-normal">{r.reason}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === 'approved' ? 'default' : r.status === 'denied' ? 'destructive' : 'outline'}
                          className="capitalize"
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending || r.status === 'approved'}
                          onClick={() => decide.mutate({ id: r.id, decision: 'approve' })}
                        >
                          <Check /> Approve
                        </Button>{' '}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={decide.isPending || r.status === 'denied'}
                          onClick={() => decide.mutate({ id: r.id, decision: 'deny' })}
                        >
                          <X /> Deny
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
