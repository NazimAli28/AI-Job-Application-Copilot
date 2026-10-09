import { Link } from 'react-router'
import { Trash2 } from 'lucide-react'
import type { AnalysisSummary } from '@copilot/shared'
import { ConfirmAction } from '@/components/common/confirm'
import { scoreTone } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDeleteAnalysis } from './api'

export function ScorePill({ score }: { score: number }) {
  return (
    <span
      title="Estimated fit"
      className={cn(
        'shrink-0 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums',
        scoreTone(score),
      )}
    >
      {Math.round(score)}%
    </span>
  )
}

export function RecentCheckRow({ a, deletable }: { a: AnalysisSummary; deletable?: boolean }) {
  const del = useDeleteAnalysis()
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <ScorePill score={a.score} />
      <div className="min-w-0 flex-1">
        <Link to={`/app/analyze/${a.id}`} className="block truncate font-medium hover:underline">
          {a.title} @ {a.company}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {a.resumeLabel} · {relativeTime(a.createdAt)}
        </p>
      </div>
      {a.savedJobId && (
        <Badge variant="secondary" asChild>
          <Link to={`/app/jobs/${a.savedJobId}`}>Saved</Link>
        </Badge>
      )}
      {deletable && (
        <ConfirmAction
          title="Delete this check?"
          description="The result will be removed. A job you saved from it stays in your tracker."
          onConfirm={() => del.mutate(a.id)}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Delete check for ${a.title}`}>
              <Trash2 />
            </Button>
          }
        />
      )}
    </li>
  )
}
