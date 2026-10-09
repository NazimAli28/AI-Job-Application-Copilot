import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { needsDescription } from '@copilot/shared'
import { ErrorState, PageSkeleton } from '@/components/common/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InterviewPrepTab } from '@/features/interviews/job-tab'
import { useJob } from './api'
import { CoverLetterTab, TailorTab } from './assistant'
import { MatchTab } from './match-tab'
import { JobHeader } from './tabs/job-header'
import { NeedsDescriptionEmpty } from './tabs/needs-description'
import { OverviewTab } from './tabs/overview-tab'
import { ResumeTab } from './tabs/resume-tab'
import { TrackingTab } from './tracking'

const TABS = [
  ['overview', 'Overview'],
  ['resume', 'Resume'],
  ['match', 'Match & gaps'],
  ['tailor', 'Tailor resume'],
  ['cover-letter', 'Cover letter'],
  ['interview', 'Interview prep'],
  ['tracking', 'Tracking'],
] as const

/** Tabs that analyze the posting text and cannot work without it. */
const NEEDS_TEXT = new Set(['match', 'tailor', 'cover-letter', 'interview'])

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: job, isPending, error, refetch } = useJob(jobId)
  const requested = params.get('tab')
  const tab = TABS.some(([k]) => k === requested) ? requested! : 'overview'

  if (isPending) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  const missing = needsDescription(job)
  const content: Record<string, ReactNode> = {
    overview: <OverviewTab job={job} />,
    resume: <ResumeTab job={job} />,
    match: <MatchTab job={job} />,
    tailor: <TailorTab job={job} />,
    'cover-letter': <CoverLetterTab job={job} />,
    interview: <InterviewPrepTab job={job} />,
    tracking: <TrackingTab job={job} />,
  }

  return (
    <div className="min-w-0">
      <JobHeader job={job} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {TABS.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map(([k]) => (
          <TabsContent key={k} value={k} className="mt-4 min-w-0">
            {k === tab &&
              (missing && NEEDS_TEXT.has(k) ? <NeedsDescriptionEmpty job={job} /> : content[k])}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
