import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarClock, CircleAlert, FileQuestion, ListChecks, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardData } from './api'
import { StatusPill, dueLabel } from './parts'

function ListCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">{children}</ul>
      </CardContent>
    </Card>
  )
}

function Row({
  id,
  title,
  company,
  right,
  rightClass,
}: {
  id: string
  title: string
  company: string
  right: ReactNode
  rightClass?: string
}) {
  return (
    <li>
      <Link to={`/app/jobs/${id}`} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 hover:bg-muted">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{company}</span>
          <span className="block truncate text-xs text-muted-foreground">{title}</span>
        </span>
        <span className={cn('shrink-0 text-right text-xs', rightClass)}>{right}</span>
      </Link>
    </li>
  )
}

export function UpcomingInterviews({ items }: { items: DashboardData['upcomingInterviews'] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" /> Upcoming interviews
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled. Add interview dates on a job.</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((u) => (
              <li key={`${u.jobId}-${u.at}`}>
                <Link to={`/app/jobs/${u.jobId}`} className="block rounded-lg border p-2.5 hover:bg-muted">
                  <p className="truncate text-sm font-medium">{u.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <time dateTime={u.at} className="text-xs">
                      {new Date(u.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                    <StatusPill status={u.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function ApplySoon({ items }: { items: DashboardData['applySoon'] }) {
  if (items.length === 0) return null
  return (
    <ListCard icon={<Timer className="size-4" />} title="Apply soon">
      {items.slice(0, 5).map((j) => (
        <Row
          key={j.id}
          {...j}
          right={dueLabel(j.applyBy)}
          rightClass={j.overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}
        />
      ))}
    </ListCard>
  )
}

export function NeedsDescription({ items }: { items: DashboardData['needsDescription'] }) {
  if (items.length === 0) return null
  return (
    <ListCard icon={<FileQuestion className="size-4" />} title="Needs a description">
      {items.slice(0, 5).map((j) => (
        <Row key={j.id} {...j} right="Paste description" rightClass="text-primary" />
      ))}
    </ListCard>
  )
}

export function NextSteps({ items }: { items: DashboardData['nextActions'] }) {
  if (items.length === 0) return null
  return (
    <ListCard icon={<ListChecks className="size-4" />} title="Next steps">
      {items.slice(0, 5).map((j) => (
        <li key={j.id}>
          <Link to={`/app/jobs/${j.id}`} className="block rounded-lg border p-2.5 hover:bg-muted">
            <p className="truncate text-sm font-medium">{j.nextAction}</p>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">
                {j.company} · {j.title}
              </span>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1',
                  j.overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                )}
              >
                {j.overdue && <CircleAlert className="size-3" aria-label="Overdue" />}
                {dueLabel(j.nextActionAt)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ListCard>
  )
}
