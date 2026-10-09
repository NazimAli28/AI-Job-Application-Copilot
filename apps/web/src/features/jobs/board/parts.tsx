import { FileText } from 'lucide-react'
import { STATUS_LABELS, type ApplicationStatus } from '@copilot/shared'
import { scoreTone } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { JobListItem } from '../api'

const TONE: Partial<Record<ApplicationStatus, string>> = {
  offer: 'bg-success/15 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
  saved: 'bg-muted text-muted-foreground',
  applied: 'bg-primary/10 text-primary',
}

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('whitespace-nowrap', TONE[status] ?? 'bg-warning/15 text-warning', className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function ScorePill({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span
      className={cn('inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums', scoreTone(score))}
      title="Estimated fit"
    >
      {Math.round(score)}% fit
    </span>
  )
}

/** Match pill, or an "Add description" prompt when there is nothing to score. */
export function MatchCell({ job }: { job: JobListItem }) {
  if (job.needsDescription)
    return (
      <Badge variant="outline" className="whitespace-nowrap border-dashed text-muted-foreground">
        Add description
      </Badge>
    )
  return <ScorePill score={job.matchScore} />
}

/** Whole days from today (local) until a YYYY-MM-DD date; negative when past. */
export function daysUntil(date?: string): number | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  const t = new Date()
  const start = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86400000)
}

export const formatDay = (date?: string) => {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Shown only within 7 days of the deadline (or overdue) for jobs not yet applied to. */
export function ApplyByBadge({ job, always }: { job: JobListItem; always?: boolean }) {
  const days = daysUntil(job.applyBy)
  if (days == null || job.status !== 'saved' || (!always && days > 7)) return always ? <span>—</span> : null
  const label = new Date(job.applyBy + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap', days <= 2 && 'border-warning/50 bg-warning/15 text-warning')}
      title={days < 0 ? 'Past the apply-by date' : `${days} day(s) left`}
    >
      {days < 0 ? 'Overdue · ' : 'Apply by '}
      {label}
    </Badge>
  )
}

export function ResumeIndicator({ job }: { job: JobListItem }) {
  if (!job.materials.resumeId) return null
  return <FileText className="size-3.5 text-muted-foreground" aria-label="Resume attached" />
}
