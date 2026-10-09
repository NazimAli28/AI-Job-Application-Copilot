import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CheckCircle2, FileText, FileUp } from 'lucide-react'
import { RESUME_MAX_BYTES, type Job, type Resume } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { EmptyState, ErrorState, PageSkeleton, Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useResumes, useUploadResume, validateResumeFile } from '@/features/resume/api'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePatchJob } from '../tracking/api'

function Option({ r, job, checked }: { r: Resume; job: Job; checked: boolean }) {
  const forThis = r.jobId === job.id
  return (
    <li>
      <label
        htmlFor={`res-${r.id}`}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
          checked && 'border-primary/50 bg-primary/5',
        )}
      >
        <RadioGroupItem id={`res-${r.id}`} value={r.id} className="mt-1" />
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{r.label || r.fileName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {r.label ? `${r.fileName} · ` : ''}uploaded {formatDate(r.uploadedAt)}
            {r.analysis && ` · score ${Math.round(r.analysis.overallScore)}`}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5 empty:hidden">
            {r.isActive && (
              <Badge className="bg-success/15 text-success">
                <CheckCircle2 className="size-3" /> Active
              </Badge>
            )}
            {forThis && <Badge variant="secondary">Uploaded for this job</Badge>}
          </span>
        </span>
      </label>
    </li>
  )
}

function UploadForJob({ job }: { job: Job }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadResume()
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handle = (file?: File) => {
    if (!file) return
    const problem = validateResumeFile(file, RESUME_MAX_BYTES)
    setError(problem)
    if (problem) return
    upload.mutate(
      { file, label: label || `Sent to ${job.company}`, jobId: job.id },
      {
        onSuccess: () => {
          setLabel('')
          toast.success('Resume uploaded and linked to this job')
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload the version you sent</CardTitle>
        <CardDescription>
          Tailored a PDF for this job? Upload it here. It is saved to your library and linked to
          this job.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        <Field label="Label" htmlFor="res-label" optional>
          <Input
            id="res-label"
            value={label}
            maxLength={80}
            placeholder={`Sent to ${job.company}`}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <div>
          <Button
            variant="outline"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? <Spinner /> : <FileUp />}{' '}
            {upload.isPending ? 'Reading your resume…' : 'Choose a PDF'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload resume PDF for this job"
            onChange={(e) => {
              handle(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export function ResumeTab({ job }: { job: Job }) {
  const { data, isPending, error, refetch } = useResumes()
  const patch = usePatchJob(job.id)
  if (isPending) return <PageSkeleton rows={2} />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const current = data.find((r) => r.id === job.materials.resumeId)
  const pick = (resumeId: string) =>
    patch.mutate(
      { materials: { ...job.materials, resumeId } },
      { onSuccess: () => toast.success('Resume saved for this job') },
    )

  return (
    <div className="grid min-w-0 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resume used for this job</CardTitle>
          <CardDescription>
            Pick the resume from your library that you sent (or plan to send).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          {data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No resumes in your library"
              description="Upload the version you sent below, or add one on the Resume page."
              className="py-8"
            />
          ) : (
            <RadioGroup
              value={job.materials.resumeId ?? ''}
              onValueChange={pick}
              disabled={patch.isPending}
              aria-label="Resume used for this job"
            >
              <ul className="grid grid-cols-1 gap-2">
                {data.map((r) => (
                  <Option key={r.id} r={r} job={job} checked={r.id === job.materials.resumeId} />
                ))}
              </ul>
            </RadioGroup>
          )}
          {job.materials.resumeId && !current && (
            <p className="text-sm text-muted-foreground">
              The resume linked to this job was deleted. Pick another.
            </p>
          )}
          {current?.analysis && (
            <p className="text-sm">
              Quick analysis score:{' '}
              <span className="font-semibold">{Math.round(current.analysis.overallScore)}</span>
              /100.{' '}
              <Link to="/app/resume" className="font-medium text-primary hover:underline">
                See the full review
              </Link>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Matching uses your active profile plus this resume, so keep both up to date.
          </p>
        </CardContent>
      </Card>
      <UploadForJob job={job} />
    </div>
  )
}
