import { useNavigate } from 'react-router'
import { RotateCcw } from 'lucide-react'
import type { InterviewSession } from '@copilot/shared'
import { ScoreRing } from '@/components/common/score'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { useCreateSession } from './api'
import { CriterionBar, EvaluationCard } from './evaluation-card'
import { sessionStats } from './stats'

export function SessionSummary({ session }: { session: InterviewSession }) {
  const navigate = useNavigate()
  const create = useCreateSession()
  const st = sessionStats(session)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
        <ScoreRing score={st.avg ?? 0} size={104} label="avg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">
            {session.status === 'completed' ? 'Session complete' : 'Session summary'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {st.answered} of {st.total} questions answered. Scores are practice feedback, not a prediction of any
            interview outcome.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              { jobId: session.jobId, mode: session.mode, questionIds: session.questions.map((q) => q.id), extraQuestions: session.questions },
              { onSuccess: (s) => navigate(`/app/interviews/${s.id}`) },
            )
          }
        >
          {create.isPending ? <Spinner /> : <RotateCcw />} Practice again
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-medium">Average by criterion</h3>
          {st.criteria.map((c) => (
            <CriterionBar key={c.key} label={c.label} value={c.value} />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border p-4 text-sm">
          {st.best && (
            <div>
              <h3 className="mb-1 font-medium text-success">Strongest answer ({st.best.score})</h3>
              <p className="text-muted-foreground">{st.best.question?.question}</p>
            </div>
          )}
          {st.worst && (
            <div>
              <h3 className="mb-1 font-medium text-warning">Needs most work ({st.worst.score})</h3>
              <p className="text-muted-foreground">{st.worst.question?.question}</p>
            </div>
          )}
          {!st.best && <p className="text-muted-foreground">Answer at least one question to see highlights.</p>}
        </div>
      </div>

      <section aria-label="Review answers" className="space-y-3">
        <h3 className="font-heading font-semibold">Review answers</h3>
        {session.questions.map((q, i) => {
          const a = session.answers.find((x) => x.questionId === q.id)
          return (
            <details key={q.id} className="group rounded-lg border bg-card">
              <summary className="cursor-pointer list-none p-3 text-sm font-medium">
                <span className="text-muted-foreground">{i + 1}.</span> {q.question}
                <span className="ml-2 text-xs text-muted-foreground">
                  {a?.evaluation ? `Score ${a.evaluation.score}` : 'Skipped'}
                </span>
              </summary>
              {a && (
                <div className="space-y-3 border-t p-3">
                  <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{a.answer}</p>
                  {a.evaluation && <EvaluationCard evaluation={a.evaluation} />}
                </div>
              )}
            </details>
          )
        })}
      </section>
    </div>
  )
}
