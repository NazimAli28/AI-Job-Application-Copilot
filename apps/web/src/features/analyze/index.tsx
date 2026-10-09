import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ClipboardList, FileSearch } from 'lucide-react'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiRequestError } from '@/lib/api'
import { useAnalyses, useAnalysis } from './api'
import { AiTab } from './ai-tab'
import { CoverTab } from './cover-tab'
import { FitTab } from './fit-tab'
import { CheckFitPanel } from './check-panel'
import { QuestionsTab } from './questions-tab'
import { RecentCheckRow } from './recent-checks'
import { ResultHeader } from './result-header'
import { ResumeTab } from './resume-tab'

export { CheckFitPanel }

const FLOW = [
  'Pick a resume',
  'Paste a job description',
  'See your fit, skill gaps, resume fixes and interview questions, then save it as a job',
]

/** /app/analyze: "Check my fit" input (resume + job) + recent checks. */
export function AnalyzePage() {
  const { data, isPending, error, refetch } = useAnalyses()
  return (
    <div className="min-w-0">
      <PageHeader title="Check my fit" description="The fastest way to know where you stand for a job." />
      <CheckFitPanel />
      <section id="recent-checks" aria-labelledby="recent-h" className="mt-8 scroll-mt-4">
        <h2 id="recent-h" className="mb-3 font-medium">
          Recent checks
        </h2>
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No checks yet"
            description="Your results will show up here."
            action={
              <ol className="list-decimal space-y-1 pl-5 text-left text-sm text-muted-foreground">
                {FLOW.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {data.map((a) => (
              <RecentCheckRow key={a.id} a={a} deletable />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const TABS = ['fit', 'resume', 'questions', 'cover', 'ai'] as const

/** /app/analyze/:analysisId: results with actions (save as job, questions, cover letter). */
export function AnalysisResultPage() {
  const { analysisId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: a, isPending, error, refetch } = useAnalysis(analysisId)
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'fit'

  if (isPending) return <PageSkeleton rows={3} />
  if (error)
    return error instanceof ApiRequestError && error.status === 404 ? (
      <EmptyState
        icon={FileSearch}
        title="This check was not found"
        description="It may have been deleted or replaced by newer checks."
        action={
          <Button asChild>
            <Link to="/app/analyze">Check a job</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState error={error} onRetry={() => refetch()} />
    )

  return (
    <div className="min-w-0 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/app/analyze">
          <ArrowLeft /> Check my fit
        </Link>
      </Button>
      <ResultHeader a={a} />
      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v }, { replace: true })}
      >
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="fit">Fit</TabsTrigger>
            <TabsTrigger value="resume">Resume for this job</TabsTrigger>
            <TabsTrigger value="questions">Interview questions</TabsTrigger>
            <TabsTrigger value="cover">Cover letter</TabsTrigger>
            <TabsTrigger value="ai">AI Pro</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="fit" className="mt-4">
          <FitTab m={a.match} />
        </TabsContent>
        <TabsContent value="resume" className="mt-4">
          <ResumeTab ra={a.resumeAnalysis} t={a.tailoring} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionsTab a={a} />
        </TabsContent>
        <TabsContent value="cover" className="mt-4">
          <CoverTab id={a.id} company={a.job.company} />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AiTab id={a.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
