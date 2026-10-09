import { useState, type FormEvent } from 'react'
import { jobInput, parseJobDescription, type JobInput } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { parseTags } from './helpers'

export type QuickInitial = { title?: string; company?: string; url?: string }

/**
 * Minimal form: "quick" = tags + note, "link" = optional pasted description.
 * Always saves valid jobInput (empty description is allowed, so the job shows "Needs description").
 */
export function QuickForm({
  mode,
  initial = {},
  submitLabel,
  pending,
  onSubmit,
}: {
  mode: 'quick' | 'link'
  initial?: QuickInitial
  submitLabel: string
  pending?: boolean
  onSubmit: (v: JobInput) => void
}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [company, setCompany] = useState(initial.company ?? '')
  const [url, setUrl] = useState(initial.url ?? '')
  const [applyBy, setApplyBy] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const p = (k: string) => ({ id: `qs-${mode}-${k}`, ...invalidProps(`qs-${mode}-${k}`, errors[k]) })

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = description.trim().length >= 50 ? parseJobDescription(description) : null
    const result = jobInput.safeParse({
      title,
      company,
      url: url.trim() || undefined,
      description: description.trim(),
      responsibilities: parsed?.responsibilities ?? [],
      requirements: parsed?.requirements ?? [],
      experienceYearsMin: parsed?.experienceYearsMin,
      educationRequirement: parsed?.educationRequirement,
      applyBy: applyBy || undefined,
      tags: parseTags(tags),
      notes: note.trim() || undefined,
    })
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const i of result.error.issues) errs[String(i.path[0])] ??= i.message
      return setErrors(errs)
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form noValidate onSubmit={submit} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Job title" htmlFor={p('title').id} error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} {...p('title')} />
        </Field>
        <Field label="Company" htmlFor={p('company').id} error={errors.company}>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} {...p('company')} />
        </Field>
        {mode === 'quick' && (
          <Field label="Job link" htmlFor={p('url').id} optional error={errors.url && 'Enter a valid URL'}>
            <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} {...p('url')} />
          </Field>
        )}
        <Field label="Apply by" htmlFor={p('applyBy').id} optional>
          <Input type="date" value={applyBy} onChange={(e) => setApplyBy(e.target.value)} {...p('applyBy')} />
        </Field>
      </div>
      {mode === 'quick' ? (
        <>
          <Field label="Tags" htmlFor={p('tags').id} optional hint="Separate with commas, e.g. remote, dream-job">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} {...p('tags')} />
          </Field>
          <Field label="Note" htmlFor={p('note').id} optional error={errors.notes}>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} {...p('note')} />
          </Field>
        </>
      ) : (
        <Field
          label="Job description"
          htmlFor={p('description').id}
          optional
          hint="Paste it now, or add it later to see your estimated fit."
        >
          <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} {...p('description')} />
        </Field>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} {submitLabel}
        </Button>
      </div>
    </form>
  )
}
