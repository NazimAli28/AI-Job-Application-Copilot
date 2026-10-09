import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePatchJob } from './api'
import { toDateInput, toLocalInput } from './dates'
import { Section } from './section'
import { same, savedToast } from './utils'

const draftOf = (job: Job) => ({
  applyBy: toDateInput(job.applyBy),
  appliedAt: toDateInput(job.appliedAt),
  nextAction: job.nextAction ?? '',
  nextActionAt: toDateInput(job.nextActionAt),
  interviews: job.interviewDates.map(toLocalInput),
})

export function DatesSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const [d, setD] = useState(() => draftOf(job))
  const [newIv, setNewIv] = useState('')
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }))

  const addInterview = () => {
    if (!newIv || d.interviews.includes(newIv)) return
    set('interviews', [...d.interviews, newIv].sort())
    setNewIv('')
  }

  return (
    <Section
      title="Key dates"
      dirty={!same(d, draftOf(job))}
      pending={patch.isPending}
      onSave={() =>
        patch.mutate(
          {
            applyBy: d.applyBy,
            appliedAt: d.appliedAt,
            nextAction: d.nextAction.trim(),
            nextActionAt: d.nextActionAt,
            interviewDates: d.interviews.map((x) => new Date(x).toISOString()),
          },
          { onSuccess: savedToast('Dates') },
        )
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Apply by" htmlFor="trk-applyby" hint="Deadline, if the posting has one">
          <Input
            id="trk-applyby"
            type="date"
            value={d.applyBy}
            onChange={(e) => set('applyBy', e.target.value)}
          />
        </Field>
        <Field label="Applied on" htmlFor="trk-appliedat">
          <Input
            id="trk-appliedat"
            type="date"
            value={d.appliedAt}
            onChange={(e) => set('appliedAt', e.target.value)}
          />
        </Field>
        <Field label="Next action" htmlFor="trk-next" optional>
          <Input
            id="trk-next"
            value={d.nextAction}
            maxLength={200}
            placeholder="e.g. Follow up with recruiter"
            onChange={(e) => set('nextAction', e.target.value)}
          />
        </Field>
        <Field label="Next action date" htmlFor="trk-nextat" optional>
          <Input
            id="trk-nextat"
            type="date"
            value={d.nextActionAt}
            onChange={(e) => set('nextActionAt', e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <p className="text-sm font-medium">Interview dates</p>
        {d.interviews.length === 0 && (
          <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
        )}
        <ul className="grid grid-cols-1 gap-1.5">
          {d.interviews.map((x) => (
            <li
              key={x}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm"
            >
              <time dateTime={x}>{new Date(x).toLocaleString()}</time>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove interview ${new Date(x).toLocaleString()}`}
                onClick={() =>
                  set(
                    'interviews',
                    d.interviews.filter((y) => y !== x),
                  )
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            aria-label="New interview date and time"
            value={newIv}
            onChange={(e) => setNewIv(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={!newIv}
            onClick={addInterview}
          >
            <Plus /> Add
          </Button>
        </div>
      </div>
    </Section>
  )
}
