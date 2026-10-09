import { AlertTriangle, CheckCircle2, CircleHelp, TriangleAlert, XCircle, type LucideIcon } from 'lucide-react'
import type { MatchResult, SkillMatchStatus } from '@copilot/shared'
import { scoreTone } from '@/components/common/score'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const GROUPS: { status: SkillMatchStatus; label: string; icon: LucideIcon; tone: string }[] = [
  { status: 'strong', label: 'Strong', icon: CheckCircle2, tone: 'text-success' },
  { status: 'partial', label: 'Partial', icon: TriangleAlert, tone: 'text-warning' },
  { status: 'missing', label: 'Missing', icon: XCircle, tone: 'text-destructive' },
  { status: 'unknown', label: 'Unknown', icon: CircleHelp, tone: 'text-muted-foreground' },
]

const alignText = { meets: 'Meets', below: 'Below', above: 'Above', unknown: 'Unknown' } as const

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

export function FitTab({ m }: { m: MatchResult }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this score</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Bar label="Required skills" value={m.breakdown.requiredSkills} />
            <Bar label="Preferred skills" value={m.breakdown.preferredSkills} />
            <Bar label="Experience" value={m.breakdown.experience} />
            <Bar label="Education" value={m.breakdown.education} />
          </div>
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

      <div>
        <h2 className="font-heading text-lg font-semibold">Skill gaps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Skills only count when your resume or profile shows evidence. Save the job to correct skills.
        </p>
      </div>
      {m.skills.length === 0 && (
        <p className="text-sm text-muted-foreground">This job lists no skill requirements to compare.</p>
      )}
      {GROUPS.map(({ status, label, icon: Icon, tone }) => {
        const items = m.skills.filter((s) => s.status === status)
        if (!items.length) return null
        return (
          <section key={status} aria-label={`${label} skills`}>
            <h3 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', tone)}>
              <Icon className="size-4" /> {label} ({items.length})
            </h3>
            <ul className="grid grid-cols-1 gap-2">
              {items.map((s) => (
                <li key={s.skill} className="rounded-lg border p-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.skill}
                    <Badge variant={s.requirementKind === 'required' ? 'default' : 'outline'}>
                      {s.requirementKind}
                    </Badge>
                  </p>
                  {s.evidence.length > 0 ? (
                    <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                      {s.evidence.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No evidence found in your resume or profile.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}

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
    </div>
  )
}
