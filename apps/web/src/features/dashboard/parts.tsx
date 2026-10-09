import { STATUS_LABELS, type ApplicationStatus } from '@copilot/shared'
import { scoreTone } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONE: Partial<Record<ApplicationStatus, string>> = {
  offer: 'bg-success/15 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
  saved: 'bg-muted text-muted-foreground',
  applied: 'bg-primary/10 text-primary',
}

export function StatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant="secondary" className={cn('whitespace-nowrap', TONE[status] ?? 'bg-warning/15 text-warning')}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function MatchValue({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn('text-xs font-medium tabular-nums', scoreTone(score))} title="Estimated fit">
      {Math.round(score)}%
    </span>
  )
}

/** "in 2 days" / "today" / "3 days overdue" for a YYYY-MM-DD date. */
export function dueLabel(date: string): string {
  const t = new Date(`${date}T00:00:00`).getTime()
  const today = new Date().setHours(0, 0, 0, 0)
  const days = Math.round((t - today) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days} days`
  return `${-days} day${days === -1 ? '' : 's'} overdue`
}
