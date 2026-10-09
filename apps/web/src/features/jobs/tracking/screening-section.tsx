import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Job, ScreeningAnswer } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { uid } from '@/lib/format'
import { usePatchJob } from './api'
import { Section } from './section'
import { same, savedToast } from './utils'

export function ScreeningSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const [items, setItems] = useState<ScreeningAnswer[]>(job.screeningAnswers)
  const edit = (id: string, p: Partial<ScreeningAnswer>) =>
    setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const valid = items.every((x) => x.question.trim())

  return (
    <Section
      title="Screening questions & answers"
      description="Save the questions the application form asked — we'll use them in interview prep."
      dirty={!same(items, job.screeningAnswers) && valid}
      pending={patch.isPending}
      onSave={() =>
        patch.mutate(
          { screeningAnswers: items.map((x) => ({ ...x, question: x.question.trim() })) },
          { onSuccess: savedToast('Answers') },
        )
      }
    >
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No questions saved yet.</p>
      )}
      <ul className="grid grid-cols-1 gap-3">
        {items.map((x, i) => (
          <li key={x.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3">
            <Field label={`Question ${i + 1}`} htmlFor={`sq-${x.id}`}>
              <Input
                id={`sq-${x.id}`}
                value={x.question}
                maxLength={500}
                onChange={(e) => edit(x.id, { question: e.target.value })}
              />
            </Field>
            <Field label="Your answer" htmlFor={`sa-${x.id}`}>
              <Textarea
                id={`sa-${x.id}`}
                rows={3}
                maxLength={5000}
                value={x.answer}
                onChange={(e) => edit(x.id, { answer: e.target.value })}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit text-destructive"
              onClick={() => setItems((l) => l.filter((y) => y.id !== x.id))}
            >
              <Trash2 /> Remove
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={items.length >= 30}
          onClick={() => setItems((l) => [...l, { id: uid('sq'), question: '', answer: '' }])}
        >
          <Plus /> Add question
        </Button>
      </div>
    </Section>
  )
}
