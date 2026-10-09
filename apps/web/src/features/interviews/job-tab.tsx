import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MessagesSquare, PlayCircle, Sparkles } from 'lucide-react'
import { needsDescription, type InterviewQuestion, type Job } from '@copilot/shared'
import { AiFeature, SourceBadge } from '@/components/common/ai'
import { EmptyState, ErrorState, GeneratingState, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { NeedsDescriptionEmpty } from '@/features/jobs/tabs/needs-description'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCreateSession, useGenerateAiQuestions, useJobQuestions } from './api'
import { AiQuestionsPreview } from './ai-preview'
import { QuestionCard } from './question-card'
import { TYPE_LABELS } from './stats'

type Filter = 'all' | InterviewQuestion['type']

function ScreeningAnswers({ job }: { job: Job }) {
  if (!job.screeningAnswers.length) return null
  return (
    <section aria-labelledby="screening-answers" className="space-y-2 rounded-xl border p-4">
      <h3 id="screening-answers" className="font-heading text-sm font-semibold">
        Your screening answers
      </h3>
      <p className="text-xs text-muted-foreground">
        What you told {job.company} on the application. Expect follow-ups, so keep your story
        consistent.
      </p>
      <ul className="space-y-3">
        {job.screeningAnswers.map((a) => (
          <li key={a.id}>
            <p className="text-sm font-medium">{a.question}</p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {a.answer || 'No answer saved.'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Job detail → "Interview prep" tab. */
export function InterviewPrepTab({ job }: { job: Job }) {
  if (needsDescription(job)) return <NeedsDescriptionEmpty job={job} />
  return <PrepContent job={job} />
}

function PrepContent({ job }: { job: Job }) {
  const navigate = useNavigate()
  const questions = useJobQuestions(job.id)
  const gen = useGenerateAiQuestions(job.id)
  const create = useCreateSession()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string[]>([])

  if (questions.isPending) return <PageSkeleton rows={3} />
  if (questions.isError)
    return <ErrorState error={questions.error} onRetry={() => questions.refetch()} />

  const aiQs = gen.data ?? []
  const all = [...questions.data, ...aiQs]
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const start = (mode: 'practice' | 'mock', ids?: string[]) =>
    create.mutate(
      { jobId: job.id, mode, questionIds: ids?.length ? ids : undefined, extraQuestions: aiQs },
      { onSuccess: (s) => navigate(`/app/interviews/${s.id}`) },
    )

  const groups = (['technical', 'behavioral', 'candidate'] as const)
    .filter((t) => filter === 'all' || filter === t)
    .map((t) => ({ type: t, items: all.filter((q) => q.type === t) }))
    .filter((g) => g.items.length)

  return (
    <div className="space-y-6">
      <ScreeningAnswers job={job} />
      {all.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No questions yet"
          description="Add more detail to the job requirements or your profile to get tailored interview questions."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter}
              onValueChange={(v) => v && setFilter(v as Filter)}
              className="flex-wrap justify-start"
              aria-label="Filter questions by type"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="technical">Technical</ToggleGroupItem>
              <ToggleGroupItem value="behavioral">Behavioral</ToggleGroupItem>
              <ToggleGroupItem value="candidate">Candidate-specific</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={create.isPending}
                onClick={() => start('practice', selected)}
              >
                <PlayCircle /> Practice {selected.length ? `${selected.length} selected` : 'these'}
              </Button>
              <Button disabled={create.isPending} onClick={() => start('mock')}>
                <MessagesSquare /> Start mock interview
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SourceBadge source="rules" /> Selected from the job&apos;s skills and your profile.
          </div>

          {groups.map((g) => (
            <section key={g.type} aria-labelledby={`grp-${g.type}`} className="space-y-2">
              <h3 id={`grp-${g.type}`} className="font-heading text-sm font-semibold">
                {TYPE_LABELS[g.type]}{' '}
                <span className="font-normal text-muted-foreground">({g.items.length})</span>
              </h3>
              <ul className="space-y-2">
                {g.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    selected={selected.includes(q.id)}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <AiFeature
        title="Candidate-specific questions"
        description="Claude reads your real experience and projects and writes questions your interviewer is likely to ask, with prep hints."
        preview={<AiQuestionsPreview />}
      >
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="size-4 text-primary" /> More candidate-specific questions
              </p>
              <p className="text-sm text-muted-foreground">
                Generated from your own profile. Nothing is invented about you.
              </p>
            </div>
            <Button variant="outline" disabled={gen.isPending} onClick={() => gen.mutate()}>
              {gen.data ? 'Regenerate' : 'Generate with AI'}
            </Button>
          </div>
          {gen.isPending && <GeneratingState label="Reading your profile…" />}
          {gen.data && gen.data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Add experience or projects to your profile first.
            </p>
          )}
          {aiQs.length > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <SourceBadge source="ai" /> {aiQs.length} added to the Candidate-specific list above.
            </p>
          )}
        </div>
      </AiFeature>
    </div>
  )
}
