import { Check, X } from 'lucide-react'
import type { BulletSuggestion, ResumeIssue, TailoringResult, ResumeAnalysis } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { ScoreRing } from '@/components/common/score'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/features/jobs/assistant/copy-button'

const SEVERITY = { high: 0, medium: 1, low: 2 } as const
const sevClass = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-muted text-muted-foreground',
} as const

function Issue({ i }: { i: ResumeIssue }) {
  return (
    <li className="rounded-lg border p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <Badge variant="secondary" className={sevClass[i.severity]}>
          {i.severity}
        </Badge>
        {i.message}
      </p>
      {i.original && <p className="mt-1.5 text-muted-foreground italic">&ldquo;{i.original}&rdquo;</p>}
      {i.suggestion && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="min-w-0">
            <span className="font-medium">Fix: </span>
            {i.suggestion}
          </p>
          <CopyButton text={i.suggestion} />
        </div>
      )}
    </li>
  )
}

function Bullet({ b }: { b: BulletSuggestion }) {
  return (
    <li className="rounded-lg border p-3 text-sm">
      <p className="text-xs text-muted-foreground">{b.section}</p>
      <p className="mt-1 text-muted-foreground line-through">{b.original}</p>
      <p className="mt-1 font-medium">{b.suggested}</p>
      <p className="mt-1 text-xs text-muted-foreground">{b.reason}</p>
      <div className="mt-2">
        <CopyButton text={b.suggested} label="Copy suggestion" />
      </div>
    </li>
  )
}

export function ResumeTab({ ra, t }: { ra: ResumeAnalysis; t: TailoringResult }) {
  const issues = [...ra.issues].sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity])
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <ScoreRing score={ra.overallScore} size={88} />
          <div>
            <p className="font-medium">Resume score for this job</p>
            <SourceBadge source={ra.source} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              Your resume re-checked with this job&apos;s keywords.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issues &amp; fixes ({issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found. Nice work.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {issues.map((i) => (
                <Issue key={i.id} i={i} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {t.keywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keywords from the job</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm">
            <ul className="flex flex-wrap gap-1.5">
              {t.keywords.map((k) => (
                <li key={k.keyword}>
                  <Badge variant={k.present ? 'secondary' : 'outline'} className="gap-1">
                    {k.present ? <Check className="size-3 text-success" /> : <X className="size-3 text-destructive" />}
                    {k.keyword}
                  </Badge>
                </li>
              ))}
            </ul>
            <ul className="grid grid-cols-1 gap-1 text-muted-foreground">
              {t.keywords
                .filter((k) => !k.present && k.suggestion)
                .map((k) => (
                  <li key={k.keyword}>
                    <span className="font-medium text-foreground">{k.keyword}:</span> {k.suggestion}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {t.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggested summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm">
            <p>{t.summary}</p>
            <div>
              <CopyButton text={t.summary} />
            </div>
          </CardContent>
        </Card>
      )}

      {t.bulletSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bullet suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2">
              {t.bulletSuggestions.map((b) => (
                <Bullet key={b.id} b={b} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Suggestions rephrase what you already wrote. Only keep what is true for you.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
