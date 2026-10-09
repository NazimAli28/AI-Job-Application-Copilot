import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Bot, Send, Sparkles, User } from 'lucide-react'
import type { InterviewSession } from '@copilot/shared'
import { useHasAi } from '@/components/common/ai'
import { ErrorState, PageSkeleton, Spinner } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCompleteSession, useSession, useSubmitAnswer } from './api'
import { EvaluationCard } from './evaluation-card'
import { SessionSummary } from './summary'
import { TYPE_LABELS } from './stats'

export function InterviewSessionPage() {
  const { sessionId = '' } = useParams()
  const q = useSession(sessionId)
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/interviews" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All sessions
      </Link>
      {q.isPending ? (
        <PageSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <SessionBody key={q.data.id} session={q.data} />
      )}
    </div>
  )
}

function SessionBody({ session }: { session: InterviewSession }) {
  const firstOpen = session.questions.findIndex((x) => !session.answers.some((a) => a.questionId === x.id))
  const [idx, setIdx] = useState(firstOpen === -1 ? session.questions.length - 1 : firstOpen)
  const [text, setText] = useState('')
  const [useAi, setUseAi] = useState(false)
  const hasAi = useHasAi()
  const submit = useSubmitAnswer(session.id)
  const complete = useCompleteSession(session.id)

  const header = (
    <div className="mb-4">
      <h1 className="font-heading text-xl font-semibold">
        {session.jobTitle} <span className="font-normal text-muted-foreground">at {session.company}</span>
      </h1>
      <Badge variant="secondary" className="mt-1">
        {session.mode === 'mock' ? 'Mock interview' : 'Practice'}
      </Badge>
    </div>
  )

  if (session.status === 'completed')
    return (
      <>
        {header}
        <SessionSummary session={session} />
      </>
    )

  const question = session.questions[idx]
  if (!question) return <ErrorState error={new Error('This session has no questions')} />
  const answered = session.answers.find((a) => a.questionId === question.id)
  const evaluation = answered?.evaluation
  const isLast = idx === session.questions.length - 1
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const done = session.answers.length

  const onSubmit = () =>
    submit.mutate({ questionId: question.id, answer: text, ai: hasAi && useAi }, { onSuccess: () => setText('') })

  return (
    <>
      {header}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>
            Question {idx + 1} of {session.questions.length}
          </span>
          <span>{done} answered</span>
        </div>
        <Progress value={(done / session.questions.length) * 100} />
      </div>

      <div className="space-y-4">
        {session.questions.slice(0, idx).map((pq) => {
          const pa = session.answers.find((a) => a.questionId === pq.id)
          return (
            <div key={pq.id} className="space-y-2 opacity-70">
              <Bubble who="interviewer">{pq.question}</Bubble>
              {pa && (
                <Bubble who="you">
                  {pa.answer}
                  {pa.evaluation && <span className="mt-1 block text-xs opacity-80">Score {pa.evaluation.score}</span>}
                </Bubble>
              )}
            </div>
          )
        })}

        <Bubble who="interviewer">
          <Badge variant="outline" className="mb-1.5 block w-fit">{TYPE_LABELS[question.type]}</Badge>
          {question.question}
        </Bubble>

        {answered ? (
          <>
            <Bubble who="you">{answered.answer}</Bubble>
            {evaluation && <EvaluationCard evaluation={evaluation} />}
            <div className="flex justify-end">
              {isLast ? (
                <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
                  {complete.isPending && <Spinner />} Finish and see summary
                </Button>
              ) : (
                <Button onClick={() => setIdx(idx + 1)}>Next question</Button>
              )}
            </div>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
            className="space-y-3 rounded-xl border bg-card p-3"
          >
            <Label htmlFor="answer" className="sr-only">
              Your answer
            </Label>
            <Textarea
              id="answer"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              placeholder="Type your answer as you would say it in the interview…"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{words} words</span>
              <div className="flex flex-wrap items-center gap-3">
                {hasAi && (
                  <div className="flex items-center gap-2">
                    <Switch id="ai-eval" checked={useAi} onCheckedChange={setUseAi} />
                    <Label htmlFor="ai-eval" className="gap-1 font-normal">
                      <Sparkles className="size-3.5 text-primary" /> Evaluate with AI
                    </Label>
                  </div>
                )}
                <Button type="submit" disabled={!text.trim() || submit.isPending}>
                  {submit.isPending ? <Spinner /> : <Send />} {submit.isPending && useAi ? 'AI is reviewing…' : 'Submit answer'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

function Bubble({ who, children }: { who: 'interviewer' | 'you'; children: React.ReactNode }) {
  const mine = who === 'you'
  return (
    <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        aria-hidden
      >
        {mine ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
      >
        <span className="sr-only">{mine ? 'You: ' : 'Interviewer: '}</span>
        {children}
      </div>
    </div>
  )
}
