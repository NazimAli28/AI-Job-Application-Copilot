import { useState, type FormEvent } from 'react'
import { Link2 } from 'lucide-react'
import { importUrlInput, type ImportUrlResult, type JobInput } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiRequestError } from '@/lib/api'
import { useImportUrl } from '../api'
import { JobForm, toDraft } from '../job-form'
import { PROVIDER_LABELS, companyFromUrl, withStatus } from './helpers'
import { QuickForm } from './quick-form'
import { StartStatus } from './start-status'

type Outcome = { kind: 'ok'; result: ImportUrlResult; key: number } | { kind: 'failed'; message: string }

export function LinkTab({ pending, onSave }: { pending: boolean; onSave: (v: JobInput) => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string>()
  const [applied, setApplied] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>()
  const imp = useImportUrl()

  function run(e: FormEvent) {
    e.preventDefault()
    const check = importUrlInput.safeParse({ url: url.trim() })
    if (!check.success) return setError(check.error.issues[0]?.message)
    setError(undefined)
    setOutcome(undefined)
    imp.mutate(check.data.url, {
      onSuccess: (result) => setOutcome({ kind: 'ok', result, key: Date.now() }),
      onError: (err) => {
        if (err instanceof ApiRequestError && err.code === 'IMPORT_FAILED') {
          setOutcome({ kind: 'failed', message: err.message })
        } else setError(err instanceof Error ? err.message : 'Something went wrong')
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <form noValidate onSubmit={run} className="grid grid-cols-1 gap-2">
        <Field label="Job link" htmlFor="import-url" error={error}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="import-url"
              type="url"
              inputMode="url"
              placeholder="https://boards.greenhouse.io/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              {...invalidProps('import-url', error)}
            />
            <Button type="submit" disabled={imp.isPending}>
              {imp.isPending ? <Spinner /> : <Link2 />} Import
            </Button>
          </div>
        </Field>
        <p className="text-xs text-muted-foreground">
          Works best with Greenhouse and Lever links. Other sites may block automatic reading.
        </p>
      </form>

      {outcome?.kind === 'ok' && (
        <section aria-label="Imported details" className="grid grid-cols-1 gap-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Imported from {PROVIDER_LABELS[outcome.result.provider] ?? 'the page'} — please check every field.
          </p>
          <StartStatus applied={applied} onChange={setApplied} id="link-applied" />
          <JobForm
            key={outcome.key}
            initial={toDraft({ ...outcome.result.job, url: outcome.result.job.url || url.trim() })}
            submitLabel="Save job"
            pending={pending}
            onSubmit={(v) => onSave(withStatus(v, applied))}
          />
        </section>
      )}

      {outcome?.kind === 'failed' && (
        <section aria-label="Save link for later" className="grid grid-cols-1 gap-4 border-t pt-4">
          <Alert>
            <AlertDescription>{outcome.message}</AlertDescription>
          </Alert>
          <StartStatus applied={applied} onChange={setApplied} id="failed-applied" />
          <QuickForm
            mode="link"
            initial={{ company: companyFromUrl(url.trim()), url: url.trim() }}
            submitLabel="Save link for later"
            pending={pending}
            onSubmit={(v) => onSave(withStatus({ ...v, url: url.trim() }, applied))}
          />
        </section>
      )}
    </div>
  )
}
