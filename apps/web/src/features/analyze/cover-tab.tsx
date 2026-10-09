import { useState } from 'react'
import { Download, Sparkles } from 'lucide-react'
import { COVER_LETTER_LENGTHS, COVER_LETTER_TONES } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CopyButton } from '@/features/jobs/assistant/copy-button'
import { useAnalysisCoverLetter } from './api'

type Length = (typeof COVER_LETTER_LENGTHS)[number]
type Tone = (typeof COVER_LETTER_TONES)[number]

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        aria-label={label}
        onValueChange={(v) => v && onChange(v as T)}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o} value={o}>
            {cap(o)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export function CoverTab({ id, company }: { id: string; company: string }) {
  const gen = useAnalysisCoverLetter(id)
  const [length, setLength] = useState<Length>('medium')
  const [tone, setTone] = useState<Tone>('professional')
  const [text, setText] = useState<string>()

  const generate = () => gen.mutate({ length, tone }, { onSuccess: (r) => setText(r.content) })
  const download = () => {
    const url = URL.createObjectURL(new Blob([text ?? ''], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cover-letter-${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Toggle label="Length" options={COVER_LETTER_LENGTHS} value={length} onChange={setLength} />
        <Toggle label="Tone" options={COVER_LETTER_TONES} value={tone} onChange={setTone} />
        <Button onClick={generate} disabled={gen.isPending}>
          {gen.isPending ? <Spinner /> : <Sparkles />} {text ? 'Regenerate' : 'Generate cover letter'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Copy it now or save the job to keep versions. Review and edit before sending. Generated from a rule-based
        template using only facts in your resume.
      </p>
      {text !== undefined && (
        <div className="grid grid-cols-1 gap-2">
          <Field label="Your cover letter (editable)" htmlFor="analysis-letter">
            <Textarea id="analysis-letter" rows={14} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} />
            <Button type="button" variant="outline" size="sm" onClick={download}>
              <Download /> Download .txt
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
