import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  certificationSchema,
  educationSchema,
  projectSchema,
  type Certification,
  type Education,
  type Project,
} from '@copilot/shared'
import type { ZodObject, ZodRawShape } from 'zod'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCollection, type CollectionName } from '../api'
import { BulletsEditor } from './bullets-editor'
import { ChipsInput } from './chips-input'
import type { FormProps } from './crud-section'

/** Shared save/cancel wiring for the simple forms. Empty strings become undefined. */
function useItemForm<T extends { id: string }>(
  name: CollectionName,
  schema: ZodObject<ZodRawShape>,
  defaults: Omit<T, 'id'>,
  { item, onDone }: FormProps<T>,
) {
  const { create, update } = useCollection<T>(name)
  const form = useForm<Omit<T, 'id'>>({
    resolver: zodResolver(schema.omit({ id: true })) as never,
    defaultValues: (item ?? defaults) as never,
  })
  const onSubmit = form.handleSubmit((v) => {
    const clean = Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, x === '' ? undefined : x]),
    ) as Omit<T, 'id'>
    const opts = { onSuccess: onDone }
    if (item) update.mutate({ ...clean, id: item.id } as never, opts)
    else create.mutate(clean, opts)
  })
  return { form, onSubmit, busy: create.isPending || update.isPending }
}

function Actions({ busy, onDone }: { busy: boolean; onDone: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onDone}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy && <Spinner />} Save
      </Button>
    </div>
  )
}

export function EducationForm(props: FormProps<Education>) {
  const { form, onSubmit, busy } = useItemForm<Education>(
    'education',
    educationSchema,
    { institution: '', degree: '' },
    props,
  )
  const {
    register,
    formState: { errors },
  } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
      <Field label="Institution" htmlFor="edu-inst" error={errors.institution?.message}>
        <Input id="edu-inst" {...invalidProps('edu-inst', errors.institution?.message)} {...register('institution')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Degree" htmlFor="edu-degree" error={errors.degree?.message}>
          <Input id="edu-degree" {...invalidProps('edu-degree', errors.degree?.message)} {...register('degree')} />
        </Field>
        <Field label="Field of study" htmlFor="edu-field" optional>
          <Input id="edu-field" {...register('field')} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Start" htmlFor="edu-start" optional>
          <Input id="edu-start" type="month" {...register('startDate')} />
        </Field>
        <Field label="End" htmlFor="edu-end" optional>
          <Input id="edu-end" type="month" {...register('endDate')} />
        </Field>
        <Field label="Grade" htmlFor="edu-grade" optional>
          <Input id="edu-grade" {...register('grade')} />
        </Field>
      </div>
      <Actions busy={busy} onDone={props.onDone} />
    </form>
  )
}

export function ProjectForm(props: FormProps<Project>) {
  const { form, onSubmit, busy } = useItemForm<Project>(
    'projects',
    projectSchema,
    { name: '', description: '', technologies: [], bullets: [] },
    props,
  )
  const {
    register,
    control,
    formState: { errors },
  } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
      <Field label="Project name" htmlFor="prj-name" error={errors.name?.message}>
        <Input id="prj-name" {...invalidProps('prj-name', errors.name?.message)} {...register('name')} />
      </Field>
      <Field label="Description" htmlFor="prj-desc" error={errors.description?.message}>
        <Textarea id="prj-desc" rows={3} {...invalidProps('prj-desc', errors.description?.message)} {...register('description')} />
      </Field>
      <Field label="Link" htmlFor="prj-url" optional error={errors.url?.message}>
        <Input id="prj-url" type="url" placeholder="https://" {...invalidProps('prj-url', errors.url?.message)} {...register('url')} />
      </Field>
      <Field label="Technologies" htmlFor="prj-tech" optional>
        <Controller
          control={control}
          name="technologies"
          render={({ field }) => (
            <ChipsInput id="prj-tech" label="technologies" value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>
      <Field label="Highlights" htmlFor="prj-bullets-0" optional>
        <Controller
          control={control}
          name="bullets"
          render={({ field }) => <BulletsEditor idPrefix="prj-bullets" value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <Actions busy={busy} onDone={props.onDone} />
    </form>
  )
}

export function CertificationForm(props: FormProps<Certification>) {
  const { form, onSubmit, busy } = useItemForm<Certification>(
    'certifications',
    certificationSchema,
    { name: '' },
    props,
  )
  const {
    register,
    formState: { errors },
  } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
      <Field label="Certification name" htmlFor="crt-name" error={errors.name?.message}>
        <Input id="crt-name" {...invalidProps('crt-name', errors.name?.message)} {...register('name')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Issuer" htmlFor="crt-issuer" optional>
          <Input id="crt-issuer" {...register('issuer')} />
        </Field>
        <Field label="Date" htmlFor="crt-date" optional>
          <Input id="crt-date" type="month" {...register('date')} />
        </Field>
      </div>
      <Field label="Credential link" htmlFor="crt-url" optional error={errors.url?.message}>
        <Input id="crt-url" type="url" placeholder="https://" {...invalidProps('crt-url', errors.url?.message)} {...register('url')} />
      </Field>
      <Actions busy={busy} onDone={props.onDone} />
    </form>
  )
}
