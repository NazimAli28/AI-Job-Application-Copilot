import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import type { Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePatchJob } from './api'
import { Section } from './section'
import { same, savedToast } from './utils'

export function NotesSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const [tags, setTags] = useState(job.tags)
  const [notes, setNotes] = useState(job.notes ?? '')
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim().replace(/,$/, '').slice(0, 30)
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && tags.length) setTags(tags.slice(0, -1))
  }

  return (
    <Section
      title="Tags & notes"
      dirty={!same({ tags, notes }, { tags: job.tags, notes: job.notes ?? '' })}
      pending={patch.isPending}
      onSave={() => patch.mutate({ tags, notes: notes.trim() }, { onSuccess: savedToast('Notes') })}
    >
      <Field label="Tags" htmlFor="trk-tags" hint="Press Enter or comma to add. Up to 10.">
        <div className="grid grid-cols-1 gap-2">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t}>
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {t}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-4"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                    >
                      <X />
                    </Button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Input
            id="trk-tags"
            value={draft}
            disabled={tags.length >= 10}
            placeholder={tags.length >= 10 ? 'Up to 10 tags' : 'Type a tag'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={add}
          />
        </div>
      </Field>
      <Field label="Notes" htmlFor="trk-notes">
        <Textarea
          id="trk-notes"
          rows={5}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
    </Section>
  )
}
