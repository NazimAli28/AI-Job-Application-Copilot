import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { InterviewQuestion } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export function QuestionCard({
  q,
  selected,
  onToggle,
}: {
  q: InterviewQuestion
  selected: boolean
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = `q-${q.id}`
  return (
    <li className="rounded-lg border bg-card">
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(q.id)}
          aria-label={`Select question: ${q.question}`}
          className="mt-1"
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
          aria-controls={panelId}
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
      </div>
      {open && (
        <div id={panelId} className="space-y-3 border-t px-4 py-3 text-sm">
          <Section title="Why they ask">{q.why}</Section>
          <Section title="Answer structure">{q.answerStructure}</Section>
          {q.hints.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your prep hints</h4>
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

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <p>{children}</p>
    </div>
  )
}
