import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { MoveRight } from 'lucide-react'
import { KANBAN_COLUMNS, STATUS_LABELS, type ApplicationStatus } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { JobListItem } from '../api'
import { ApplyByBadge, MatchCell, ResumeIndicator } from './parts'

export const columnOf = (s: ApplicationStatus) => KANBAN_COLUMNS.find((c) => c.statuses.includes(s))!

function MoveMenu({ job, onMove }: { job: JobListItem; onMove: (s: ApplicationStatus) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="ml-auto" aria-label={`Move ${job.title} to…`}>
          <MoveRight /> Move to…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {KANBAN_COLUMNS.flatMap((c) => c.statuses).map((s) => (
          <DropdownMenuItem key={s} disabled={s === job.status} onClick={() => onMove(s)}>
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CardBody({
  job,
  onMove,
  handle,
}: {
  job: JobListItem
  onMove?: (s: ApplicationStatus) => void
  handle?: ReactNode
}) {
  const subStatuses = columnOf(job.status).statuses.length > 1
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
      <div className="flex items-start gap-1">
        {handle}
        <div className="min-w-0 flex-1">
          <Link to={`/app/jobs/${job.id}`} className="block truncate text-sm font-medium hover:underline">
            {job.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{job.company}</p>
        </div>
        <ResumeIndicator job={job} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MatchCell job={job} />
        <ApplyByBadge job={job} />
        {subStatuses && <Badge variant="secondary">{STATUS_LABELS[job.status]}</Badge>}
      </div>
      {job.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tags">
          {job.tags.slice(0, 2).map((t) => (
            <li key={t}>
              <Badge variant="outline" className="text-[10px]">
                {t}
              </Badge>
            </li>
          ))}
          {job.tags.length > 2 && (
            <li>
              <Badge variant="outline" className="text-[10px]">
                +{job.tags.length - 2}
              </Badge>
            </li>
          )}
        </ul>
      )}
      {onMove && (
        <div className="mt-1.5 flex">
          <MoveMenu job={job} onMove={onMove} />
        </div>
      )}
    </div>
  )
}
