import { useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import type { Job } from '@copilot/shared'
import { ErrorState, GeneratingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCoverLetters,
  useDeleteCoverLetter,
  useGenerateCoverLetter,
  useHighlightables,
  useSaveCoverLetter,
} from './api'
import { CoverLetterOptions, type Options } from './cover-letter-options'
import { LetterEditor, LetterVersions } from './letter-editor'

export function CoverLetterTab({ job }: { job: Job }) {
  const letters = useCoverLetters(job.id)
  const profile = useHighlightables()
  const gen = useGenerateCoverLetter(job.id)
  const save = useSaveCoverLetter(job.id)
  const del = useDeleteCoverLetter(job.id)
  const [opts, setOpts] = useState<Options>({ length: 'medium', tone: 'professional', highlightIds: [], companyInfo: '' })
  const [picked, setPicked] = useState<string | null>(null)

  const list = letters.data ?? []
  const current = list.find((l) => l.id === picked) ?? list[0]
  const generate = (useAi: boolean) =>
    gen.mutate(
      { ...opts, companyInfo: opts.companyInfo?.trim() || undefined, useAi },
      { onSuccess: (l) => setPicked(l.id) },
    )

  return (
    <div className="space-y-6">
      <CoverLetterOptions
        value={opts}
        onChange={setOpts}
        experience={profile.data?.experience ?? []}
        projects={profile.data?.projects ?? []}
        busy={gen.isPending}
        onGenerate={generate}
      />
      {gen.isPending && (
        <GeneratingState label="Drafting your cover letter…" steps={['Reading your profile', 'Matching it to the job']} />
      )}
      {letters.isLoading && <Skeleton className="h-64 w-full" />}
      {letters.isError && <ErrorState error={letters.error} onRetry={() => letters.refetch()} />}
      {!letters.isLoading && !letters.isError && !current && !gen.isPending && (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
          <FileText className="mb-2 size-6 text-primary" />
          <p className="font-medium">No cover letters yet</p>
          <p className="text-sm text-muted-foreground">Choose your options above and generate a first draft you can edit.</p>
        </div>
      )}
      {current && !gen.isPending && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-3">
            <LetterEditor
              key={`${current.id}-${current.updatedAt}`}
              letter={current}
              jobLabel={`${job.company}-${job.title}`}
              saving={save.isPending}
              onSave={(content) => save.mutate({ id: current.id, content })}
            />
            <Button variant="outline" size="sm" onClick={() => generate(current.source === 'ai')}>
              <RefreshCw /> Regenerate
            </Button>
          </div>
          <LetterVersions
            letters={list}
            selectedId={current.id}
            onSelect={setPicked}
            onDelete={(id) => del.mutate(id, { onSuccess: () => id === picked && setPicked(null) })}
          />
        </div>
      )}
    </div>
  )
}
