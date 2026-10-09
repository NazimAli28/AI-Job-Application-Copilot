import { ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import type { Job, Source, TailoringResult } from '@copilot/shared'
import { AiFeature } from '@/components/common/ai'
import { EmptyState, ErrorState, GeneratingState, Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiTailoring, useGenerateTailoring, useTailoring } from './api'
import { TailorAiPreview } from './ai-preview'
import { TailorResult } from './tailor-result'

type Q = {
  isLoading: boolean
  isError: boolean
  error: unknown
  data: TailoringResult | null | undefined
  refetch: () => unknown
}

function Generator({ job, source, query }: { job: Job; source: Source; query: Q }) {
  const gen = useGenerateTailoring(job.id, source)
  const label = source === 'ai' ? 'Generate with AI' : 'Generate tailoring suggestions'
  const Icon = source === 'ai' ? Sparkles : Wand2

  if (query.isLoading) return <Skeleton className="h-40 w-full" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (gen.isPending)
    return (
      <GeneratingState
        label={source === 'ai' ? 'AI is rewording your real bullets…' : 'Comparing your profile to the job…'}
        steps={['Reading your profile', 'Checking keyword coverage', 'Drafting reviewable suggestions']}
      />
    )
  const result = query.data
  if (!result)
    return (
      <EmptyState
        icon={Icon}
        title={source === 'ai' ? 'No AI suggestions yet' : 'No tailoring suggestions yet'}
        description="Suggestions are generated from your saved profile and this job's requirements."
        action={
          <Button onClick={() => gen.mutate()}>
            <Icon /> {label}
          </Button>
        }
      />
    )
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => gen.mutate()}>
          {gen.isPending ? <Spinner /> : <Icon />} Regenerate
        </Button>
      </div>
      <TailorResult job={job} result={result} source={source} />
    </div>
  )
}

function RulesGenerator({ job }: { job: Job }) {
  return <Generator job={job} source="rules" query={useTailoring(job.id)} />
}

function AiGenerator({ job }: { job: Job }) {
  return <Generator job={job} source="ai" query={useAiTailoring(job.id)} />
}

export function TailorTab({ job }: { job: Job }) {
  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck />
        <AlertDescription>
          Suggestions never add experience you don&apos;t have. Review every change.
        </AlertDescription>
      </Alert>
      <RulesGenerator job={job} />
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="size-4 text-primary" /> AI bullet rewrites
        </h2>
        <AiFeature
          title="AI tailoring"
          description="Reword your real bullets and draft a summary for this job. You approve every change."
          preview={<TailorAiPreview />}
        >
          <AiGenerator job={job} />
        </AiFeature>
      </div>
    </div>
  )
}
