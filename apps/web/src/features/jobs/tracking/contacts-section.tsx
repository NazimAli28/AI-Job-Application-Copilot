import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { contactSchema, type Contact, type Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uid } from '@/lib/format'
import { usePatchJob } from './api'
import { Section } from './section'
import { same, savedToast } from './utils'

const FIELDS = [
  ['name', 'Name', 'text'],
  ['role', 'Role', 'text'],
  ['email', 'Email', 'email'],
  ['phone', 'Phone', 'tel'],
  ['linkedinUrl', 'LinkedIn URL', 'url'],
] as const

export function ContactsSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const [items, setItems] = useState<Contact[]>(job.contacts)
  const [showErrors, setShowErrors] = useState(false)
  const edit = (id: string, p: Partial<Contact>) =>
    setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const errorsOf = (c: Contact) => {
    const r = contactSchema.safeParse(c)
    const out: Record<string, string> = {}
    if (!r.success) for (const i of r.error.issues) out[String(i.path[0])] ??= i.message
    return out
  }
  const allValid = items.every((c) => Object.keys(errorsOf(c)).length === 0)

  return (
    <Section
      title="Contacts"
      description="Recruiters, hiring managers or anyone who referred you."
      dirty={!same(items, job.contacts)}
      pending={patch.isPending}
      onSave={() => {
        if (!allValid) return setShowErrors(true)
        patch.mutate({ contacts: items }, { onSuccess: savedToast('Contacts') })
      }}
    >
      {items.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
      <ul className="grid grid-cols-1 gap-3">
        {items.map((c) => {
          const errs = showErrors ? errorsOf(c) : {}
          return (
            <li key={c.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELDS.map(([k, label, type]) => (
                  <Field
                    key={k}
                    label={label}
                    htmlFor={`ct-${c.id}-${k}`}
                    error={errs[k]}
                    optional={k !== 'name'}
                  >
                    <Input
                      id={`ct-${c.id}-${k}`}
                      type={type}
                      value={c[k] ?? ''}
                      aria-invalid={!!errs[k] || undefined}
                      onChange={(e) => edit(c.id, { [k]: e.target.value })}
                    />
                  </Field>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-destructive"
                onClick={() => setItems((l) => l.filter((x) => x.id !== c.id))}
              >
                <Trash2 /> Remove
              </Button>
            </li>
          )
        })}
      </ul>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={items.length >= 20}
          onClick={() => setItems((l) => [...l, { id: uid('ct'), name: '' }])}
        >
          <Plus /> Add contact
        </Button>
      </div>
    </Section>
  )
}
