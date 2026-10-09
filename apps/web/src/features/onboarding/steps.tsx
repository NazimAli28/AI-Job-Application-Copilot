import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { WORK_TYPES, workType, type Profile, type ProfileSkill, type Resume } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { ScoreRing } from '@/components/common/score'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCollection, useImportFromResume, useSaveProfile } from '@/features/profile/api'
import { ChipsInput } from '@/features/profile/components/chips-input'
import { UploadZone } from '@/features/resume/components/upload-zone'

const basicsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name'),
  location: z.string().max(80).optional(),
  targetTitles: z.array(z.string()).min(1, 'Add at least one target job title').max(10),
  yearsExperience: z.number('Enter a number').min(0).max(60),
  workTypes: z.array(workType),
})
type Basics = z.infer<typeof basicsSchema>

const WORK_LABELS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const

export function BasicsStep({
  base,
  skipSave,
  onNext,
}: {
  base: Profile
  skipSave: boolean
  onNext: () => void
}) {
  const save = useSaveProfile()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Basics>({ resolver: zodResolver(basicsSchema) as never, defaultValues: base })

  const submit = handleSubmit((v) => {
    if (skipSave) return onNext()
    save.mutate({ ...base, ...v, location: v.location || undefined }, { onSuccess: onNext })
  })

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4">
      <Field label="Full name" htmlFor="ob-name" error={errors.fullName?.message}>
        <Input id="ob-name" autoComplete="name" {...invalidProps('ob-name', errors.fullName?.message)} {...register('fullName')} />
      </Field>
      <Field label="Location" htmlFor="ob-loc" optional>
        <Input id="ob-loc" placeholder="City, Country" {...register('location')} />
      </Field>
      <Field label="Target job titles" htmlFor="ob-titles" error={errors.targetTitles?.message} hint="Press Enter after each title.">
        <Controller
          control={control}
          name="targetTitles"
          render={({ field }) => (
            <ChipsInput id="ob-titles" label="target titles" max={10} value={field.value} onChange={field.onChange} placeholder="e.g. Frontend Developer" />
          )}
        />
      </Field>
      <Field label="Years of experience" htmlFor="ob-years" error={errors.yearsExperience?.message}>
        <Input id="ob-years" type="number" min={0} max={60} step={0.5} inputMode="decimal" {...invalidProps('ob-years', errors.yearsExperience?.message)} {...register('yearsExperience', { valueAsNumber: true })} />
      </Field>
      <div className="grid grid-cols-1 gap-1.5">
        <span id="ob-wt" className="text-sm font-medium">
          Work types you are open to
        </span>
        <Controller
          control={control}
          name="workTypes"
          render={({ field }) => (
            <ToggleGroup type="multiple" variant="outline" aria-labelledby="ob-wt" value={field.value} onValueChange={field.onChange} className="flex-wrap justify-start">
              {WORK_TYPES.map((w) => (
                <ToggleGroupItem key={w} value={w}>
                  {WORK_LABELS[w]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />} Continue
        </Button>
      </div>
    </form>
  )
}

export function ResumeStep({
  uploaded,
  onUploaded,
  onBack,
  onNext,
}: {
  uploaded: Resume | null
  onUploaded: (r: Resume) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-5">
      {uploaded?.analysis ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-6 text-center">
          <ScoreRing score={uploaded.analysis.overallScore} size={110} label="Quick score" />
          <p className="font-medium">{uploaded.fileName}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A rule-based estimate. You will find specific fixes on the Resume page after setup.
          </p>
        </div>
      ) : (
        <UploadZone compact onUploaded={onUploaded} />
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant={uploaded ? 'default' : 'outline'} onClick={onNext}>
          {uploaded ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  )
}

export function SkillsStep({
  resume,
  existing,
  skipSave,
  onBack,
  onNext,
}: {
  resume: Resume | null
  existing: ProfileSkill[]
  skipSave: boolean
  onBack: () => void
  onNext: () => void
}) {
  const have = new Set(existing.map((s) => s.name.toLowerCase()))
  const found = (resume?.parsed?.skills ?? []).filter((s) => !have.has(s.toLowerCase()))
  const [picked, setPicked] = useState<string[]>(found)
  const [extra, setExtra] = useState<string[]>([])
  const [alsoImport, setAlsoImport] = useState(true)
  const importer = useImportFromResume()
  const { create } = useCollection<ProfileSkill>('skills')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (skipSave) return onNext()
    setBusy(true)
    try {
      if (resume?.parsed && (picked.length || alsoImport))
        await importer.mutateAsync({
          skills: picked,
          experience: alsoImport,
          education: alsoImport,
          projects: alsoImport,
        })
      const names = new Set([...have, ...picked.map((p) => p.toLowerCase())])
      for (const name of extra.filter((e) => !names.has(e.toLowerCase())))
        await create.mutateAsync({ name, status: 'confirmed', source: 'manual' })
      onNext()
    } catch {
      /* errors are toasted by the mutation cache */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {found.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Skills found in your resume</legend>
          <p className="mb-3 text-sm text-muted-foreground">Untick anything that is not really yours.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {found.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <Checkbox id={`ob-sk-${s}`} checked={picked.includes(s)} onCheckedChange={(c) => setPicked(c === true ? [...picked, s] : picked.filter((x) => x !== s))} />
                <Label htmlFor={`ob-sk-${s}`} className="font-normal">
                  {s}
                </Label>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox id="ob-also" checked={alsoImport} onCheckedChange={(c) => setAlsoImport(c === true)} />
            <Label htmlFor="ob-also" className="font-normal">
              Also import experience, education and projects
            </Label>
          </div>
        </fieldset>
      )}
      <Field label={found.length ? 'Add more skills' : 'Your skills'} htmlFor="ob-extra" hint="Press Enter after each skill.">
        <ChipsInput id="ob-extra" label="skills" value={extra} onChange={setExtra} placeholder="e.g. TypeScript, Figma" />
      </Field>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => void submit()} disabled={busy}>
          {busy && <Spinner />} Continue
        </Button>
      </div>
    </div>
  )
}
