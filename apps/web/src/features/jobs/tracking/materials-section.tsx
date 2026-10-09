import { useState } from 'react'
import { Link } from 'react-router'
import { FileText } from 'lucide-react'
import type { Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { useCoverLetters } from '../assistant/api'
import { useResumes } from '@/features/resume/api'
import { AttachmentsList } from './attachments'
import { usePatchJob } from './api'
import { Section } from './section'
import { same, savedToast } from './utils'

const NONE = '__none'
const OWN = '__own'

const draftOf = (job: Job) => ({
  choice: job.materials.coverLetterId ?? (job.materials.coverLetterText ? OWN : NONE),
  text: job.materials.coverLetterText ?? '',
})

function ResumeSummary({ job }: { job: Job }) {
  const resumes = useResumes()
  const r = resumes.data?.find((x) => x.id === job.materials.resumeId)
  return (
    <div className="grid grid-cols-1 gap-1.5">
      <p className="text-sm font-medium">Resume used</p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        {r ? (
          <span className="min-w-0 truncate">
            {r.label || r.fileName}
            {r.analysis && (
              <span className="text-muted-foreground">
                {' '}
                · score {Math.round(r.analysis.overallScore)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {job.materials.resumeId ? 'That resume was deleted.' : 'No resume recorded yet.'}
          </span>
        )}
        <Link
          to={`/app/jobs/${job.id}?tab=resume`}
          className="ml-auto font-medium text-primary hover:underline"
        >
          {r ? 'Change' : 'Choose'}
        </Link>
      </div>
    </div>
  )
}

export function MaterialsSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const letters = useCoverLetters(job.id)
  const [d, setD] = useState(() => draftOf(job))

  return (
    <div className="grid grid-cols-1 gap-4">
      <Section
        title="What I sent"
        description="Record exactly what went out with this application."
        dirty={!same(d, draftOf(job))}
        pending={patch.isPending}
        saveLabel="Save materials"
        onSave={() =>
          patch.mutate(
            {
              materials: {
                ...job.materials,
                coverLetterId: d.choice !== NONE && d.choice !== OWN ? d.choice : undefined,
                coverLetterText: d.choice === OWN ? d.text.trim() || undefined : undefined,
              },
            },
            { onSuccess: savedToast('Materials') },
          )
        }
      >
        <ResumeSummary job={job} />
        <Field label="Cover letter sent" htmlFor="trk-letter">
          <Select value={d.choice} onValueChange={(v) => setD({ ...d, choice: v })}>
            <SelectTrigger id="trk-letter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No cover letter</SelectItem>
              {(letters.data ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Generated letter · {l.tone} · {formatDate(l.createdAt)}
                </SelectItem>
              ))}
              <SelectItem value={OWN}>Paste the letter I sent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {d.choice === OWN && (
          <Field label="Cover letter text" htmlFor="trk-letter-text">
            <Textarea
              id="trk-letter-text"
              rows={8}
              maxLength={10000}
              value={d.text}
              onChange={(e) => setD({ ...d, text: e.target.value })}
            />
          </Field>
        )}
        {d.choice !== NONE && d.choice !== OWN && (
          <p className="text-xs text-muted-foreground">
            Edit or generate letters in the{' '}
            <Link to={`/app/jobs/${job.id}?tab=cover-letter`} className="underline">
              Cover letter tab
            </Link>
            .
          </p>
        )}
      </Section>
      <AttachmentsList job={job} />
    </div>
  )
}
