import { Link } from 'react-router'
import { MessagesSquare, Plus, Trash2 } from 'lucide-react'
import { ConfirmAction } from '@/components/common/confirm'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { scoreTone } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDeleteSession, useSessions } from './api'
import { NewSessionDialog } from './new-session-dialog'
import { sessionStats } from './stats'

export function InterviewsPage() {
  const sessions = useSessions()
  const del = useDeleteSession()
  const newBtn = (
    <Button>
      <Plus /> New session
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Interview coach"
        description="Practice questions for your saved jobs and get feedback on every answer."
        actions={<NewSessionDialog trigger={newBtn} />}
      />
      {sessions.isPending ? (
        <PageSkeleton rows={3} />
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : sessions.data.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No interview sessions yet"
          description="Start a mock interview for one of your saved jobs. Feedback is rule-based and free."
          action={<NewSessionDialog trigger={newBtn} />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {sessions.data.map((s) => {
            const st = sessionStats(s)
            return (
              <li key={s.id}>
                <Card className="py-0">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/interviews/${s.id}`} className="block truncate font-medium hover:underline">
                        {s.jobTitle} <span className="font-normal text-muted-foreground">at {s.company}</span>
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={s.mode === 'mock' ? 'default' : 'secondary'}>
                          {s.mode === 'mock' ? 'Mock' : 'Practice'}
                        </Badge>
                        <Badge variant="outline">{s.status === 'completed' ? 'Completed' : 'In progress'}</Badge>
                        <span>{formatDate(s.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:w-64">
                      <div className="flex-1">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {st.answered}/{st.total} answered
                        </p>
                        <Progress value={st.total ? (st.answered / st.total) * 100 : 0} />
                      </div>
                      <div className="w-14 text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">Avg</p>
                        <p className={cn('font-heading text-lg font-semibold tabular-nums', st.avg !== null && scoreTone(st.avg))}>
                          {st.avg ?? '–'}
                        </p>
                      </div>
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Delete session for ${s.jobTitle}`}>
                            <Trash2 />
                          </Button>
                        }
                        title="Delete this session?"
                        description="Your answers and feedback for this session will be removed."
                        onConfirm={() => del.mutate(s.id)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
