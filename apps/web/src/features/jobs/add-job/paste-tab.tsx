import { useState } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseJobInput, type JobInput, type ParsedJob } from '@copilot/shared'
import { useHasAi } from '@/components/common/ai'
import { Field, invalidProps } from '@/components/common/field'
import { GeneratingState, Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useParseJob } from '../api'
import { JobForm, toDraft } from '../job-form'
import { withStatus } from './helpers'
import { StartStatus } from './start-status'

export function PasteTab({ pending, onSave }: { pending: boolean; onSave: (v: JobInput) => void }) {
  const hasAi = useHasAi()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const [applied, setApplied] = useState(false)
  const [parsed, setParsed] = useState<{ job: ParsedJob; key: number; ai: boolean }>()
  const parse = useParseJob(false)
  const parseAi = useParseJob(true)
  const busy = parse.isPending || parseAi.isPending

  function extract(ai: boolean) {
    const check = parseJobInput.safeParse({ description: text })
    if (!check.success) return setError(check.error.issues[0]?.message)
    setError(undefined)
    ;(ai ? parseAi : parse).mutate(text, {
      onSuccess: (job) => {
        setParsed({ job, key: Date.now(), ai })
        toast.success('Details extracted. Review and edit before saving.')
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Job description" htmlFor="jd-text" error={error}>
        <Textarea
          id="jd-text"
          rows={parsed ? 4 : 9}
          placeholder="Paste a job description — from a website, an email, or a PDF"
          value={text}
          onChange={(e) => setText(e.target.value)}
          {...invalidProps('jd-text', error)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => extract(false)} disabled={busy}>
          {parse.isPending ? <Spinner /> : <Wand2 />} Extract details
        </Button>
        {hasAi && (
          <Button type="button" variant="outline" onClick={() => extract(true)} disabled={busy}>
            {parseAi.isPending ? <Spinner /> : <Sparkles />} Extract with AI
          </Button>
        )}
      </div>
      {!hasAi && (
        <p className="text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline size-3 text-primary" />
          Smarter extraction with AI is available in AI Pro. Rule-based extraction works for most postings.
        </p>
      )}
      {parseAi.isPending && <GeneratingState label="Reading the posting..." />}
      {parsed && (
        <section aria-label="Extracted details" className="grid grid-cols-1 gap-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {parsed.ai ? 'Extracted with AI' : 'Extracted with rules'} — please check every field.
          </p>
          <StartStatus applied={applied} onChange={setApplied} id="paste-applied" />
          <JobForm
            key={parsed.key}
            initial={toDraft(parsed.job, text)}
            submitLabel="Save job"
            pending={pending}
            onSubmit={(v) => onSave(withStatus(v, applied))}
          />
        </section>
      )}
    </div>
  )
}
