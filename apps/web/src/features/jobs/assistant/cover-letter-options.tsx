import { Link } from 'react-router'
import { Lock, Sparkles, Wand2 } from 'lucide-react'
import {
  COVER_LETTER_LENGTHS,
  COVER_LETTER_TONES,
  type CoverLetterInput,
  type Experience,
  type Project,
} from '@copilot/shared'
import { useHasAi } from '@/components/common/ai'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type Options = Omit<CoverLetterInput, 'useAi'>

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      <Label id={`cl-${label}`}>{label}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`cl-${label}`}
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        className="flex-wrap justify-start"
      >
        {options.map((o) => (
          <ToggleGroupItem key={o} value={o} className="capitalize">
            {o}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export function CoverLetterOptions({
  value,
  onChange,
  experience,
  projects,
  busy,
  onGenerate,
}: {
  value: Options
  onChange: (v: Options) => void
  experience: Experience[]
  projects: Project[]
  busy: boolean
  onGenerate: (useAi: boolean) => void
}) {
  const hasAi = useHasAi()
  const toggle = (id: string, on: boolean) =>
    onChange({
      ...value,
      highlightIds: on ? [...value.highlightIds, id] : value.highlightIds.filter((x) => x !== id),
    })
  const items = [
    ...experience.map((e) => ({ id: e.id, label: `${e.title} @ ${e.company}`, kind: 'Experience' })),
    ...projects.map((p) => ({ id: p.id, label: p.name, kind: 'Project' })),
  ]
  return (
    <form
      noValidate
      className="space-y-5 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        onGenerate(false)
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Choice label="Length" value={value.length} options={COVER_LETTER_LENGTHS} onChange={(length) => onChange({ ...value, length })} />
        <Choice label="Tone" value={value.tone} options={COVER_LETTER_TONES} onChange={(tone) => onChange({ ...value, tone })} />
      </div>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-1 text-sm font-medium">
          Highlight <span className="font-normal text-muted-foreground">(optional, defaults to your latest role)</span>
        </legend>
        {items.length ? (
          items.map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <Checkbox
                id={`hl-${i.id}`}
                checked={value.highlightIds.includes(i.id)}
                onCheckedChange={(c) => toggle(i.id, c === true)}
              />
              <Label htmlFor={`hl-${i.id}`} className="font-normal">
                {i.label} <span className="text-xs text-muted-foreground">({i.kind})</span>
              </Label>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Add experience or projects to your profile to highlight them.</p>
        )}
      </fieldset>
      <Field
        label="Company info you've verified"
        htmlFor="cl-company"
        optional
        hint="We won't invent company facts. Only what you type here is used."
      >
        <Textarea
          id="cl-company"
          rows={3}
          maxLength={2000}
          value={value.companyInfo ?? ''}
          onChange={(e) => onChange({ ...value, companyInfo: e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : <Wand2 />} Generate
        </Button>
        {hasAi ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => onGenerate(true)}>
            <Sparkles /> Generate with AI
          </Button>
        ) : (
          <Button asChild variant="outline" title="AI Pro is invite-only. Request access in Settings.">
            <Link to="/app/settings#ai-access">
              <Lock /> Generate with AI (AI Pro)
            </Link>
          </Button>
        )}
      </div>
    </form>
  )
}
