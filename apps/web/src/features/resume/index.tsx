import { useState } from 'react'
import { FileText } from 'lucide-react'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useResumes } from './api'
import { AiSection } from './components/ai-section'
import { AnalysisView } from './components/analysis-view'
import { ParsedPanel } from './components/parsed-panel'
import { ResumeList } from './components/resume-list'
import { UploadZone } from './components/upload-zone'

export function ResumePage() {
  const { data, isPending, error, refetch } = useResumes()
  const [picked, setPicked] = useState<string | null>(null)
  if (isPending) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const selected = data.find((r) => r.id === picked) ?? data.find((r) => r.isActive) ?? data[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Resume"
        description="Upload a PDF to get a rule-based review. Your active resume is used for job matching."
      />
      <Card>
        <CardHeader>
          <CardTitle>{data.length ? 'Upload another resume' : 'Upload your resume'}</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadZone compact={data.length > 0} onUploaded={(r) => setPicked(r.id)} />
        </CardContent>
      </Card>

      {data.length === 0 || !selected ? (
        <EmptyState
          icon={FileText}
          title="No resume yet"
          description="Once you upload one, you will see a score, specific fixes and the data we could import into your profile."
        />
      ) : (
        <>
          <section aria-label="Your resumes">
            <h2 className="mb-2 font-heading text-lg font-semibold">Your resumes</h2>
            <ResumeList resumes={data} selectedId={selected.id} onSelect={setPicked} />
          </section>
          {selected.analysis && (
            <section aria-label="Analysis" className="space-y-6">
              <h2 className="font-heading text-lg font-semibold">
                Analysis of {selected.fileName}
              </h2>
              <AnalysisView analysis={selected.analysis} />
              {selected.parsed && (
                <ParsedPanel parsed={selected.parsed} isActive={selected.isActive} />
              )}
              <AiSection resume={selected} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
