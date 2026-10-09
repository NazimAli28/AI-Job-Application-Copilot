import { useState } from 'react'
import { ChevronDown, MessagesSquare } from 'lucide-react'
import type { Analysis, InterviewQuestion } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SaveJobDialog } from './save-dialog'

const GROUPS: { type: InterviewQuestion['type']; label: string }[] = [
  { type: 'technical', label: 'Technical' },
  { type: 'behavioral', label: 'Behavioral' },
  { type: 'candidate', label: 'About your background' },
]

function Detail({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <p>{children}</p>
    </div>
  )
}

function Question({ q }: { q: InterviewQuestion }) {
  const [open, setOpen] = useState(false)
  const panel = `aq-${q.id}`
  return (
    <li className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-start gap-2 p-3 text-left"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{q.question}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {q.skill && <Badge variant="secondary">{q.skill}</Badge>}
            {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
          </span>
        </span>
        <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={panel} className="space-y-3 border-t px-4 py-3 text-sm">
          <Detail title="Why they ask">{q.why}</Detail>
          <Detail title="Answer structure">{q.answerStructure}</Detail>
          {q.hints.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Your prep hints
              </h4>
              <ul className="list-disc space-y-1 pl-5">
                {q.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function QuestionsTab({ a }: { a: Analysis }) {
  return (
    <div className="grid grid-cols-1 gap-5">
      {a.questions.length === 0 && (
        <p className="text-sm text-muted-foreground">No interview questions were generated for this job.</p>
      )}
      {GROUPS.map(({ type, label }) => {
        const items = a.questions.filter((q) => q.type === type)
        if (!items.length) return null
        return (
          <section key={type} aria-label={`${label} questions`}>
            <h3 className="mb-2 text-sm font-semibold">
              {label} ({items.length})
            </h3>
            <ul className="grid grid-cols-1 gap-2">
              {items.map((q) => (
                <Question key={q.id} q={q} />
              ))}
            </ul>
          </section>
        )
      })}
      {!a.savedJobId && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            <MessagesSquare className="size-4 shrink-0 text-primary" />
            Want to rehearse these out loud and get feedback?
          </p>
          <SaveJobDialog a={a} trigger={<Button>Save job to practice a mock interview</Button>} />
        </div>
      )}
    </div>
  )
}
