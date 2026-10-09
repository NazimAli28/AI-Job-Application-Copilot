import { Link } from 'react-router'
import { ArrowRight, Briefcase, CheckCircle2, Circle, FileUp, Plus } from 'lucide-react'
import type { AnalysisSummary, DashboardStats } from '@copilot/shared'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CheckFitPanel } from '@/features/analyze/check-panel'
import { useAnalyses } from '@/features/analyze/api'
import { RecentCheckRow } from '@/features/analyze/recent-checks'
import { useDashboard, type DashboardData } from './api'
import { ApplySoon, NeedsDescription, NextSteps, UpcomingInterviews } from './lists'
import { MatchValue, StatusPill } from './parts'

const STAT_CARDS: { key: keyof DashboardStats; label: string; pct?: boolean }[] = [
  { key: 'totalApplications', label: 'Total applications' },
  { key: 'savedJobs', label: 'Saved jobs' },
  { key: 'active', label: 'Active' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'offers', label: 'Offers' },
  { key: 'rejections', label: 'Rejections' },
  { key: 'interviewRate', label: 'Interview rate', pct: true },
  { key: 'offerRate', label: 'Offer rate', pct: true },
]

function Checklist({ d, hasChecks }: { d: DashboardData; hasChecks: boolean }) {
  const steps = [
    { done: hasChecks, label: 'Check your fit for a job', to: '/app/analyze' },
    { done: d.counts.profile, label: 'Complete your profile', to: '/app/profile' },
    { done: d.counts.resumes > 0, label: 'Upload a resume', to: '/app/resume' },
    { done: d.counts.jobs > 0, label: 'Add your first job', to: '/app/jobs?add=1' },
    { done: d.stats.totalApplications > 0, label: 'Mark your first job as applied', to: '/app/jobs' },
  ]
  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Finish setting up</CardTitle>
        <CardDescription>A few steps to get the most out of Copilot.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.label}>
              <Link to={s.to} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm hover:bg-muted">
                {s.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                <span className={cn(s.done && 'text-muted-foreground line-through')}>{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild variant="link" size="sm" className="mt-2 px-0">
          <Link to="/app/onboarding">Open guided setup</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentChecks({ items }: { items: AnalysisSummary[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Recent checks
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/analyze">See all</Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your fit checks will show up here.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {items.map((a) => (
              <RecentCheckRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RecentJobs({ items }: { items: DashboardData['recent'] }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="hidden sm:table-cell">Position</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Applied</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((j) => (
            <TableRow key={j.id}>
              <TableCell className="max-w-40 truncate font-medium">
                <Link to={`/app/jobs/${j.id}`} className="hover:underline">
                  {j.company}
                </Link>
                <span className="block truncate text-xs font-normal text-muted-foreground sm:hidden">{j.title}</span>
              </TableCell>
              <TableCell className="hidden max-w-56 truncate sm:table-cell">{j.title}</TableCell>
              <TableCell>
                <MatchValue score={j.matchScore} />
              </TableCell>
              <TableCell>
                <StatusPill status={j.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(j.appliedAt)}</TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${j.title} at ${j.company}`}>
                  <Link to={`/app/jobs/${j.id}`}>
                    <ArrowRight />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function DashboardPage() {
  const { data, isPending, error, refetch } = useDashboard()
  const { data: checkList } = useAnalyses()
  const checks = checkList ?? []
  if (isPending) return <PageSkeleton rows={4} />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="min-w-0">
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance."
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link to="/app/jobs?add=1">
                <Plus /> Add job
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/resume">
                <FileUp /> Upload resume
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-6">
        <CheckFitPanel compact />
      </div>
      {!data.onboardingComplete && <Checklist d={data} hasChecks={checks.length > 0} />}
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <Card key={c.key} size="sm">
            <CardContent>
              <dt className="text-xs text-muted-foreground">{c.label}</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">
                {data.stats[c.key]}
                {c.pct && '%'}
              </dd>
            </CardContent>
          </Card>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0" aria-labelledby="recent-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-h" className="font-medium">
              Recent jobs
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/jobs">View all</Link>
            </Button>
          </div>
          {data.recent.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs yet"
              description="Save a job posting or paste a link, then track it through your pipeline."
              action={
                <Button asChild>
                  <Link to="/app/jobs?add=1">
                    <Plus /> Add a job
                  </Link>
                </Button>
              }
            />
          ) : (
            <RecentJobs items={data.recent} />
          )}
        </section>
        <div className="min-w-0 space-y-4">
          <RecentChecks items={checks.slice(0, 3)} />
          <UpcomingInterviews items={data.upcomingInterviews} />
          <ApplySoon items={data.applySoon} />
          <NextSteps items={data.nextActions} />
          <NeedsDescription items={data.needsDescription} />
        </div>
      </div>
    </div>
  )
}
