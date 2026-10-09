import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SKILL_LEVELS, SKILL_STATUSES, profileSkillSchema, type ProfileSkill } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useCollection } from '../api'
import type { FormProps } from './crud-section'

const input = profileSkillSchema.omit({ id: true, source: true })
type Values = Omit<ProfileSkill, 'id' | 'source'>

const selectCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export const STATUS_LABEL = { confirmed: 'Confirmed', learning: 'Learning', rejected: 'Not me' } as const
export const statusClass = (s: ProfileSkill['status']) =>
  cn(
    s === 'confirmed' && 'bg-success/15 text-success',
    s === 'learning' && 'bg-warning/15 text-warning',
    s === 'rejected' && 'bg-muted text-muted-foreground line-through',
  )

const optNum = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v))

export function SkillForm({ item, onDone }: FormProps<ProfileSkill>) {
  const { create, update } = useCollection<ProfileSkill>('skills')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(input) as never,
    defaultValues: item ?? { name: '', status: 'confirmed' },
  })
  const submit = handleSubmit((v) => {
    const data = { ...v, level: v.level || undefined, evidence: v.evidence || undefined }
    const opts = { onSuccess: onDone }
    if (item) update.mutate({ ...data, id: item.id }, opts)
    else create.mutate({ ...data, source: 'manual' }, opts)
  })
  const busy = create.isPending || update.isPending

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4">
      <Field label="Skill" htmlFor="sk-name" error={errors.name?.message}>
        <Input id="sk-name" placeholder="e.g. TypeScript" {...invalidProps('sk-name', errors.name?.message)} {...register('name')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Level" htmlFor="sk-level" optional>
          <select id="sk-level" className={selectCls} {...register('level', { setValueAs: (v: string) => v || undefined })}>
            <option value="">Not set</option>
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l[0]!.toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Years" htmlFor="sk-years" optional error={errors.years?.message}>
          <Input
            id="sk-years"
            type="number"
            min={0}
            max={50}
            step={0.5}
            inputMode="decimal"
            {...register('years', { setValueAs: optNum })}
          />
        </Field>
        <Field label="Status" htmlFor="sk-status">
          <select id="sk-status" className={selectCls} {...register('status')}>
            {SKILL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Evidence"
        htmlFor="sk-evidence"
        optional
        error={errors.evidence?.message}
        hint="Where you used it (project, job). Helps keep suggestions honest."
      >
        <Textarea id="sk-evidence" rows={2} {...register('evidence')} />
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
