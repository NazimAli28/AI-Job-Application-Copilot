import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { experienceSchema, type Experience } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCollection } from '../api'
import { BulletsEditor } from './bullets-editor'
import { ChipsInput } from './chips-input'
import type { FormProps } from './crud-section'

const input = experienceSchema.omit({ id: true })
type Values = Omit<Experience, 'id'>

export function ExperienceForm({ item, onDone }: FormProps<Experience>) {
  const { create, update } = useCollection<Experience>('experience')
  const busy = create.isPending || update.isPending
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(input) as never,
    defaultValues: item ?? {
      title: '',
      company: '',
      location: '',
      startDate: '',
      current: false,
      bullets: [''],
      technologies: [],
    },
  })
  const current = watch('current')

  const submit = handleSubmit((v) => {
    if (!v.current && !v.endDate)
      return setError('endDate', { message: 'Add an end date or tick "I currently work here"' })
    const data: Values = {
      ...v,
      endDate: v.current ? undefined : v.endDate,
      bullets: v.bullets.map((b) => b.trim()).filter(Boolean),
    }
    const opts = { onSuccess: onDone }
    if (item) update.mutate({ ...data, id: item.id }, opts)
    else create.mutate(data, opts)
  })

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Job title" htmlFor="exp-title" error={errors.title?.message}>
          <Input id="exp-title" {...invalidProps('exp-title', errors.title?.message)} {...register('title')} />
        </Field>
        <Field label="Company" htmlFor="exp-company" error={errors.company?.message}>
          <Input id="exp-company" {...invalidProps('exp-company', errors.company?.message)} {...register('company')} />
        </Field>
      </div>
      <Field label="Location" htmlFor="exp-location" optional error={errors.location?.message}>
        <Input id="exp-location" {...register('location')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="exp-start" error={errors.startDate && 'Choose a start month'}>
          <Input id="exp-start" type="month" {...invalidProps('exp-start', errors.startDate?.message)} {...register('startDate')} />
        </Field>
        <Field label="End date" htmlFor="exp-end" error={errors.endDate?.message}>
          <Input
            id="exp-end"
            type="month"
            disabled={current}
            {...invalidProps('exp-end', errors.endDate?.message)}
            {...register('endDate')}
          />
        </Field>
      </div>
      <Controller
        control={control}
        name="current"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox id="exp-current" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
            <Label htmlFor="exp-current">I currently work here</Label>
          </div>
        )}
      />
      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="exp-bullets-0">Achievements and responsibilities</Label>
        <Controller
          control={control}
          name="bullets"
          render={({ field }) => <BulletsEditor idPrefix="exp-bullets" value={field.value} onChange={field.onChange} />}
        />
      </div>
      <Field label="Technologies used" htmlFor="exp-tech" optional>
        <Controller
          control={control}
          name="technologies"
          render={({ field }) => (
            <ChipsInput
              id="exp-tech"
              label="technologies"
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. React, PostgreSQL"
            />
          )}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Spinner />} Save
        </Button>
      </div>
    </form>
  )
}
