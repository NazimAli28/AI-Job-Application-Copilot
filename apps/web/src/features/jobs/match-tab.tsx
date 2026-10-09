import { Link } from 'react-router'
import { AlertTriangle, Info, Sparkles } from 'lucide-react'
import type { Job, MatchResult } from '@copilot/shared'
import { AiFeature, SourceBadge } from '@/components/common/ai'
import { ScoreRing, scoreTone } from '@/components/common/score'
import { ErrorState, GeneratingState, PageSkeleton } from '@/components/common/states'
import { ApiRequestError } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useAiMatch, useMatch } from './api'
import { GapsSection } from './gaps-tab'
import { NeedsDescriptionEmpty } from './tabs/needs-description'
import { AiMatchPreview } from './ai-preview'

export const hasLimitedData = (m: MatchResult) =>
  m.skills.length > 0 && m.skills.every((s) => s.status === 'missing' || s.status === 'unknown')

function Bar({ label, value }: { label: string; value: number }) {
  const v = Math.round(value)
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className={cn('font-medium tabular-nums', scoreTone(v))}>{v}%</span>
      </div>
      <Progress value={v} aria-label={label} />
    </div>
  )
}

const alignText = { meets: 'Meets', below: 'Below', above: 'Above', unknown: 'Unknown' } as const

function AiSection({ jobId }: { jobId: string }) {
  const ai = useAiMatch(jobId)
  return (
    <AiFeature
      title="AI fit explanation and learning plan"
      description="A natural-language explanation of your fit and a prioritized plan to close the gaps."
      preview={<AiMatchPreview />}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            AI fit explanation <SourceBadge source="ai" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          {ai.isPending ? (
            <GeneratingState label="Writing your explanation..." />
          ) : ai.data ? (
            <>
              <p className="text-sm">{ai.data.explanation}</p>
              <div>
                <p className="text-sm font-medium">Prioritized learning plan</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {ai.data.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                AI output is a suggestion. Review it before acting on it.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a richer explanation based on the same evidence the rule-based match uses.
            </p>
          )}
          <Button
            className="w-fit"
            variant={ai.data ? 'outline' : 'default'}
            disabled={ai.isPending}
            onClick={() => ai.mutate()}
          >
            <Sparkles /> {ai.data ? 'Regenerate' : 'Generate AI explanation'}
          </Button>
        </CardContent>
      </Card>
    </AiFeature>
  )
}

export function MatchTab({ job }: { job: Job }) {
  const { data: m, isPending, error, refetch } = useMatch(job.id)
  if (isPending) return <PageSkeleton rows={2} />
  if (error)
    return error instanceof ApiRequestError && error.code === 'NEEDS_DESCRIPTION' ? (
      <NeedsDescriptionEmpty job={job} />
    ) : (
      <ErrorState error={error} onRetry={() => refetch()} />
    )

  return (
    <div className="grid grid-cols-1 gap-4">
      {hasLimitedData(m) && (
        <Alert>
          <Info />
          <AlertTitle>Your match is based on limited data</AlertTitle>
          <AlertDescription>
            Add skills and experience to your{' '}
            <Link to="/app/profile" className="font-medium underline">
              profile
            </Link>{' '}
            or upload a{' '}
            <Link to="/app/resume" className="font-medium underline">
              resume
            </Link>{' '}
            for a more useful estimate.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing score={m.score} size={112} />
            <div>
              <p className="text-sm font-medium">Estimated fit</p>
              <SourceBadge source={m.source} className="mt-1" />
              <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                An estimate from your resume and profile, not a prediction of hiring outcomes.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Bar label="Required skills" value={m.breakdown.requiredSkills} />
            <Bar label="Preferred skills" value={m.breakdown.preferredSkills} />
            <Bar label="Experience" value={m.breakdown.experience} />
            <Bar label="Education" value={m.breakdown.education} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this score</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm">
          <p>{m.explanation}</p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['Experience', m.experienceAlignment],
                ['Education', m.educationAlignment],
              ] as const
            ).map(([k, a]) => (
              <div key={k} className="rounded-lg border p-3">
                <dt className="font-medium">
                  {k}: <span className="text-muted-foreground">{alignText[a.status]}</span>
                </dt>
                <dd className="mt-1 text-muted-foreground">{a.detail}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {m.conflicts.length > 0 && (
        <Alert className="border-warning/50 text-warning">
          <AlertTriangle />
          <AlertTitle>Possible conflicts</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {m.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {m.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {m.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <GapsSection jobId={job.id} match={m} />

      <AiSection jobId={job.id} />
    </div>
  )
}
