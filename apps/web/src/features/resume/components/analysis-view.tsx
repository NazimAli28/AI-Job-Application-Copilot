import { useState } from 'react'
import { Check, Copy, Lightbulb } from 'lucide-react'
import type { ResumeAnalysis, ResumeIssue } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { ScoreRing, scoreTone } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const SEVERITY = {
  high: { label: 'High priority', cls: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Medium', cls: 'bg-warning/15 text-warning' },
  low: { label: 'Nice to have', cls: 'bg-muted text-muted-foreground' },
} as const

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check /> : <Copy />} {done ? 'Copied' : 'Copy'}
    </Button>
  )
}

function IssueRow({ issue }: { issue: ResumeIssue }) {
  return (
    <li className="rounded-lg border p-3 text-sm">
      <p className="font-medium">{issue.message}</p>
      {issue.section && <p className="text-xs text-muted-foreground">Section: {issue.section}</p>}
      {issue.original && (
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-muted-foreground">
          <span className="mr-1 text-xs font-medium uppercase">Original</span>
          {issue.original}
        </p>
      )}
      {issue.suggestion && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-primary/5 p-2">
          <p className="flex-1">
            <span className="mr-1 text-xs font-medium text-primary uppercase">Suggestion</span>
            {issue.suggestion}
          </p>
          <CopyButton text={issue.suggestion} />
        </div>
      )}
    </li>
  )
}

/** Overall score, category breakdown, grouped issues and recommendations for one analysis. */
export function AnalysisView({ analysis }: { analysis: ResumeAnalysis }) {
  const groups = (['high', 'medium', 'low'] as const)
    .map((sev) => ({ sev, items: analysis.issues.filter((i) => i.severity === sev) }))
    .filter((g) => g.items.length)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing score={analysis.overallScore} size={110} label="Overall" />
            <div>
              <SourceBadge source={analysis.source} />
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                An estimate of how well your resume reads to applicant tracking systems and
                recruiters.
              </p>
            </div>
          </div>
          <div className="grid flex-1 gap-3">
            {analysis.categories.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.label}</span>
                  <span className={cn('font-medium tabular-nums', scoreTone(c.score))}>
                    {Math.round(c.score)}
                  </span>
                </div>
                <Progress value={c.score} aria-label={`${c.label} score`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What we noticed</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {analysis.categories
            .filter((c) => c.observations.length)
            .map((c) => (
              <div key={c.key}>
                <p className="mb-1 text-sm font-medium">{c.label}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {c.observations.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issues &amp; fixes</CardTitle>
          <CardDescription>
            Suggestions only rephrase what you wrote or ask you for real details. Never add numbers
            you can&apos;t back up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No issues found. Nice work.</p>
          )}
          {groups.map(({ sev, items }) => (
            <section key={sev} aria-label={SEVERITY[sev].label}>
              <Badge className={cn('mb-2', SEVERITY[sev].cls)}>
                {SEVERITY[sev].label} ({items.length})
              </Badge>
              <ul className="space-y-2">
                {items.map((i) => (
                  <IssueRow key={i.id} issue={i} />
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>

      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" /> {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
