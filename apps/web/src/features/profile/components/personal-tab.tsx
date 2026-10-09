import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { WORK_TYPES, profileSchema, type Profile } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSaveProfile } from '../api'
import { ChipsInput } from './chips-input'

type FormValues = Profile
const optNum = (v: unknown) => (v === '' || v === null || Number.isNaN(Number(v)) ? undefined : Number(v))

const WORK_LABELS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const

export function emptyProfile(name = '', email = ''): Profile {
  return {
    fullName: name,
    email,
    targetTitles: [],
    yearsExperience: 0,
    workTypes: [],
    preferredLocations: [],
    salaryCurrency: 'USD',
  }
}

/** Personal details + job preferences in one form (edit, then Save). */
export function PersonalTab({ profile, defaults }: { profile: Profile | null; defaults: Profile }) {
  const save = useSaveProfile()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: profile ?? defaults,
  })

  const onSubmit = handleSubmit((v) => save.mutate(v, { onSuccess: () => reset(v) }))
  const err = (k: keyof Profile) => errors[k]?.message as string | undefined

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Used to pre-fill cover letters and shown nowhere else.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="p-name" error={err('fullName')}>
            <Input id="p-name" autoComplete="name" {...invalidProps('p-name', err('fullName'))} {...register('fullName')} />
          </Field>
          <Field label="Email" htmlFor="p-email" error={err('email')}>
            <Input id="p-email" type="email" autoComplete="email" {...invalidProps('p-email', err('email'))} {...register('email')} />
          </Field>
          <Field label="Phone" htmlFor="p-phone" optional error={err('phone')}>
            <Input id="p-phone" type="tel" autoComplete="tel" {...register('phone')} />
          </Field>
          <Field label="Location" htmlFor="p-loc" optional error={err('location')}>
            <Input id="p-loc" placeholder="City, Country" {...register('location')} />
          </Field>
          <Field label="LinkedIn" htmlFor="p-li" optional error={err('linkedinUrl')}>
            <Input id="p-li" type="url" placeholder="https://" {...invalidProps('p-li', err('linkedinUrl'))} {...register('linkedinUrl')} />
          </Field>
          <Field label="GitHub" htmlFor="p-gh" optional error={err('githubUrl')}>
            <Input id="p-gh" type="url" placeholder="https://" {...invalidProps('p-gh', err('githubUrl'))} {...register('githubUrl')} />
          </Field>
          <Field label="Portfolio" htmlFor="p-pf" optional error={err('portfolioUrl')} className="sm:col-span-2">
            <Input id="p-pf" type="url" placeholder="https://" {...invalidProps('p-pf', err('portfolioUrl'))} {...register('portfolioUrl')} />
          </Field>
          <Field
            label="Professional summary"
            htmlFor="p-sum"
            optional
            error={err('summary')}
            hint="2–3 sentences about what you do and what you're looking for. Only include what's true."
            className="sm:col-span-2"
          >
            <Textarea id="p-sum" rows={4} {...register('summary')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job preferences</CardTitle>
          <CardDescription>Drives job matching and what the assistant recommends.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Target job titles" htmlFor="p-titles" error={err('targetTitles')} hint="Up to 10. Press Enter to add." className="sm:col-span-2">
            <Controller
              control={control}
              name="targetTitles"
              render={({ field }) => (
                <ChipsInput id="p-titles" label="target titles" max={10} value={field.value} onChange={field.onChange} placeholder="e.g. Frontend Developer" />
              )}
            />
          </Field>
          <Field label="Years of experience" htmlFor="p-years" error={err('yearsExperience')}>
            <Input id="p-years" type="number" min={0} max={60} step={0.5} inputMode="decimal" {...invalidProps('p-years', err('yearsExperience'))} {...register('yearsExperience', { valueAsNumber: true })} />
          </Field>
          <div className="grid grid-cols-1 gap-1.5">
            <span id="p-wt-label" className="text-sm font-medium">
              Work types
            </span>
            <Controller
              control={control}
              name="workTypes"
              render={({ field }) => (
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  aria-labelledby="p-wt-label"
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex-wrap justify-start"
                >
                  {WORK_TYPES.map((w) => (
                    <ToggleGroupItem key={w} value={w}>
                      {WORK_LABELS[w]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </div>
          <Field label="Preferred locations" htmlFor="p-locs" className="sm:col-span-2" optional>
            <Controller
              control={control}
              name="preferredLocations"
              render={({ field }) => (
                <ChipsInput id="p-locs" label="locations" max={10} value={field.value} onChange={field.onChange} placeholder="e.g. Berlin, Remote (EU)" />
              )}
            />
          </Field>
          <Field label="Salary min" htmlFor="p-smin" optional error={err('salaryMin')}>
            <Input id="p-smin" type="number" min={0} inputMode="numeric" {...register('salaryMin', { setValueAs: optNum })} />
          </Field>
          <Field label="Salary max" htmlFor="p-smax" optional error={err('salaryMax')}>
            <Input id="p-smax" type="number" min={0} inputMode="numeric" {...register('salaryMax', { setValueAs: optNum })} />
          </Field>
          <Field label="Currency (3 letters)" htmlFor="p-cur" error={err('salaryCurrency')}>
            <Input id="p-cur" maxLength={3} className="uppercase" {...invalidProps('p-cur', err('salaryCurrency'))} {...register('salaryCurrency', { setValueAs: (v: string) => v.toUpperCase() })} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t bg-background/90 px-1 py-3 backdrop-blur">
        {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        <Button type="button" variant="outline" disabled={!isDirty} onClick={() => reset(profile ?? defaults)}>
          Discard
        </Button>
        <Button type="submit" disabled={save.isPending || (!!profile && !isDirty)}>
          {save.isPending && <Spinner />} Save profile
        </Button>
      </div>
    </form>
  )
}
