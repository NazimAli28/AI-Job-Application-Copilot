import { useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_TYPES, jobInput, type Job, type JobInput, type ParsedJob } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { uid } from '@/lib/format'
import { RequirementsEditor, ResponsibilitiesEditor, selectClass } from './list-editors'

export type Draft = {
  title: string
  company: string
  location: string
  employmentType: string
  workType: string
  url: string
  salary: string
  description: string
  experienceYearsMin: string
  educationRequirement: string
  responsibilities: string[]
  requirements: JobInput['requirements']
}

export function toDraft(p: ParsedJob | Job = { responsibilities: [], requirements: [] }, description = ''): Draft {
  return {
    title: p.title ?? '',
    company: p.company ?? '',
    location: p.location ?? '',
    employmentType: p.employmentType ?? '',
    workType: p.workType ?? '',
    url: p.url ?? '',
    salary: p.salary ?? '',
    description: p.description ?? description,
    experienceYearsMin: p.experienceYearsMin != null ? String(p.experienceYearsMin) : '',
    educationRequirement: p.educationRequirement ?? '',
    responsibilities: p.responsibilities,
    requirements: p.requirements.map((r) => ({ ...r, id: r.id || uid('req') })),
  }
}

function toInput(d: Draft) {
  const opt = (s: string) => s.trim() || undefined
  return {
    title: d.title,
    company: d.company,
    location: opt(d.location),
    employmentType: opt(d.employmentType),
    workType: opt(d.workType),
    url: opt(d.url),
    salary: opt(d.salary),
    description: d.description,
    experienceYearsMin: d.experienceYearsMin.trim() === '' ? undefined : Number(d.experienceYearsMin),
    educationRequirement: opt(d.educationRequirement),
    responsibilities: d.responsibilities.map((r) => r.trim()).filter(Boolean),
    requirements: d.requirements
      .filter((r) => r.text.trim())
      .map((r) => ({
        ...r,
        text: r.text.trim(),
        skill: r.category === 'skill' ? r.skill?.trim() || undefined : undefined,
      })),
  }
}

export function JobForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  reextract,
}: {
  initial: Draft
  submitLabel: string
  pending?: boolean
  onSubmit: (v: JobInput) => void
  onCancel?: () => void
  /** Shows "Re-extract requirements" which re-parses the current description (edit flow). */
  reextract?: { pending?: boolean; run: (description: string) => Promise<ParsedJob> }
}) {
  const [d, setD] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))
  const bind = (k: keyof Draft & string) => ({
    id: `job-${k}`,
    value: d[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    ...invalidProps(`job-${k}`, errors[k]),
  })

  async function rerun() {
    const p = await reextract?.run(d.description)
    if (!p) return
    setD((prev) => ({
      ...prev,
      responsibilities: p.responsibilities,
      requirements: p.requirements.map((r) => ({ ...r, id: r.id || uid('req') })),
      experienceYearsMin: p.experienceYearsMin != null ? String(p.experienceYearsMin) : prev.experienceYearsMin,
      educationRequirement: p.educationRequirement ?? prev.educationRequirement,
    }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = jobInput.safeParse(toInput(d))
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message
      setErrors(errs)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form noValidate onSubmit={submit} className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Job title" htmlFor="job-title" error={errors.title}>
          <Input {...bind('title')} />
        </Field>
        <Field label="Company" htmlFor="job-company" error={errors.company}>
          <Input {...bind('company')} />
        </Field>
        <Field label="Location" htmlFor="job-location" optional error={errors.location}>
          <Input {...bind('location')} />
        </Field>
        <Field label="Salary" htmlFor="job-salary" optional error={errors.salary}>
          <Input {...bind('salary')} placeholder="e.g. $90k-$110k" />
        </Field>
        <Field label="Employment type" htmlFor="job-employmentType" optional>
          <select className={selectClass} {...bind('employmentType')}>
            <option value="">Not specified</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work type" htmlFor="job-workType" optional>
          <select className={selectClass} {...bind('workType')}>
            <option value="">Not specified</option>
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job posting URL" htmlFor="job-url" optional error={errors.url && 'Enter a valid URL'}>
          <Input type="url" inputMode="url" {...bind('url')} />
        </Field>
        <Field
          label="Minimum years of experience"
          htmlFor="job-experienceYearsMin"
          optional
          error={errors.experienceYearsMin}
        >
          <Input type="number" min={0} max={30} step="0.5" {...bind('experienceYearsMin')} />
        </Field>
        <Field
          label="Education requirement"
          htmlFor="job-educationRequirement"
          optional
          className="sm:col-span-2"
          error={errors.educationRequirement}
        >
          <Input {...bind('educationRequirement')} placeholder="e.g. Bachelor's degree in Computer Science" />
        </Field>
      </div>
      <Field label="Job description" htmlFor="job-description" error={errors.description}>
        <Textarea rows={6} {...bind('description')} />
      </Field>
      {reextract && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={reextract.pending || d.description.trim().length < 50}
          onClick={rerun}
        >
          {reextract.pending ? <Spinner /> : <RefreshCw />} Re-extract requirements from description
        </Button>
      )}
      <section className="grid grid-cols-1 gap-2" aria-label="Responsibilities">
        <h3 className="text-sm font-medium">Responsibilities</h3>
        <ResponsibilitiesEditor value={d.responsibilities} onChange={(v) => set('responsibilities', v)} />
      </section>
      <section className="grid grid-cols-1 gap-2" aria-label="Requirements">
        <h3 className="text-sm font-medium">Requirements</h3>
        <p className="text-xs text-muted-foreground">Only add what the posting actually asks for.</p>
        <RequirementsEditor value={d.requirements} onChange={(v) => set('requirements', v)} />
      </section>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} {submitLabel}
        </Button>
      </div>
    </form>
  )
}
